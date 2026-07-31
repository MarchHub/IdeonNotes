import {
    existsSync,
    readFileSync,
    promises as fs,
} from "node:fs";
import path from "node:path";
import type { SiteConfig } from "vitepress";

const ASSET_ELEMENT_PATTERN = /<(img|source)\b[^>]*>/gi;
const ASSET_ATTRIBUTE_PATTERN =
    /\b(src|srcset)(\s*=\s*)(["'])([\s\S]*?)\3/gi;
const MAIN_CONTENT_PATTERN =
    /<main\b[^>]*class="[^"]*\bmain\b[^"]*"[^>]*>([\s\S]*?)<\/main>/i;
const EXTERNAL_OR_SPECIAL_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

interface AssetElement {
    name: string;
    attributes: Map<string, string>;
}

interface RssAssetPluginOptions {
    baseUrl: string;
    filename?: string;
}

type BuildEndHook = NonNullable<SiteConfig["buildEnd"]>;

interface ResolvedVitePressConfig {
    vitepress?: {
        buildEnd?: BuildEndHook;
    };
}

function shouldPreserveUrl(value: string): boolean {
    const url = value.trim();

    return (
        url.length === 0 ||
        url.startsWith("#") ||
        url.startsWith("//") ||
        EXTERNAL_OR_SPECIAL_URL_PATTERN.test(url)
    );
}

export function absolutizeAssetUrl(
    value: string,
    articleUrl: string,
): string {
    if (shouldPreserveUrl(value)) return value;

    try {
        return new URL(value, articleUrl).href;
    } catch {
        return value;
    }
}

function rewriteSrcset(value: string, articleUrl: string): string {
    let index = 0;
    let result = "";

    while (index < value.length) {
        while (index < value.length && /[\s,]/.test(value[index])) {
            result += value[index];
            index += 1;
        }

        if (index >= value.length) break;

        const urlStart = index;
        const isDataUrl = value.slice(index, index + 5).toLowerCase() === "data:";

        while (
            index < value.length &&
            !/\s/.test(value[index]) &&
            (isDataUrl || value[index] !== ",")
        ) {
            index += 1;
        }

        let assetUrl = value.slice(urlStart, index);
        let trailingDelimiter = "";

        if (isDataUrl && assetUrl.endsWith(",")) {
            assetUrl = assetUrl.slice(0, -1);
            trailingDelimiter = ",";
        }

        result += absolutizeAssetUrl(assetUrl, articleUrl);
        result += trailingDelimiter;

        while (index < value.length && value[index] !== ",") {
            result += value[index];
            index += 1;
        }

        if (index < value.length) {
            result += value[index];
            index += 1;
        }
    }

    return result;
}

function readAttributes(element: string): Map<string, string> {
    const attributes = new Map<string, string>();

    for (const match of element.matchAll(ASSET_ATTRIBUTE_PATTERN)) {
        attributes.set(match[1].toLowerCase(), match[4]);
    }

    return attributes;
}

function readAssetElements(html: string): AssetElement[] {
    return [...html.matchAll(ASSET_ELEMENT_PATTERN)].map((match) => ({
        name: match[1].toLowerCase(),
        attributes: readAttributes(match[0]),
    }));
}

function readPageAssetElements(pageHtml?: string): AssetElement[] {
    if (!pageHtml) return [];

    const mainContent = pageHtml.match(MAIN_CONTENT_PATTERN)?.[1];
    return mainContent ? readAssetElements(mainContent) : [];
}

export function rewriteHtmlAssetUrls(
    html: string,
    articleUrl: string,
    pageHtml?: string,
): string {
    const pageAssets = readPageAssetElements(pageHtml);
    const pageAssetIndexes = new Map<string, number>();

    return html.replace(ASSET_ELEMENT_PATTERN, (element, rawName: string) => {
        const name = rawName.toLowerCase();
        const currentIndex = pageAssetIndexes.get(name) ?? 0;
        const pageAsset = pageAssets.filter((asset) => asset.name === name)[
            currentIndex
        ];

        pageAssetIndexes.set(name, currentIndex + 1);

        return element.replace(
            ASSET_ATTRIBUTE_PATTERN,
            (
                attribute,
                rawAttributeName: string,
                separator: string,
                quote: string,
                originalValue: string,
            ) => {
                const attributeName = rawAttributeName.toLowerCase();
                const pageValue = pageAsset?.attributes.get(attributeName);
                const value = pageValue ?? originalValue;
                const rewritten =
                    attributeName === "srcset"
                        ? rewriteSrcset(value, articleUrl)
                        : absolutizeAssetUrl(value, articleUrl);

                return `${rawAttributeName}${separator}${quote}${rewritten}${quote}`;
            },
        );
    });
}

function decodeXmlText(value: string): string {
    return value
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'");
}

export function rewriteRssFeedAssets(
    feedXml: string,
    getPageHtml: (articleUrl: string) => string | undefined,
): string {
    return feedXml.replace(/<item>([\s\S]*?)<\/item>/g, (item) => {
        const articleUrlMatch = item.match(/<link>([^<]+)<\/link>/);
        const contentMatch = item.match(
            /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/,
        );

        if (!articleUrlMatch || !contentMatch) return item;

        const articleUrl = decodeXmlText(articleUrlMatch[1]);
        const rewrittenContent = rewriteHtmlAssetUrls(
            contentMatch[1],
            articleUrl,
            getPageHtml(articleUrl),
        );

        return item.replace(contentMatch[1], () => rewrittenContent);
    });
}

function resolvePageFile(
    outDir: string,
    articleUrl: string,
    baseUrl: string,
    siteBase: string,
): string | undefined {
    let url: URL;

    try {
        url = new URL(articleUrl);
    } catch {
        return undefined;
    }

    if (url.origin !== new URL(baseUrl).origin) return undefined;

    const decodedPath = decodeURIComponent(url.pathname);
    const normalizedBase = `/${siteBase.replace(/^\/|\/$/g, "")}`;
    const pathWithoutBase =
        normalizedBase === "/"
            ? decodedPath
            : decodedPath.startsWith(`${normalizedBase}/`)
              ? decodedPath.slice(normalizedBase.length)
              : decodedPath;
    const relativePage = pathWithoutBase.replace(/^\/+|\/+$/g, "");
    const candidates =
        relativePage.length === 0
            ? ["index.html"]
            : relativePage.endsWith(".html")
              ? [relativePage]
              : [`${relativePage}.html`, path.join(relativePage, "index.html")];
    const resolvedOutDir = path.resolve(outDir);

    return candidates
        .map((candidate) => path.resolve(resolvedOutDir, candidate))
        .find(
            (candidate) =>
                candidate.startsWith(`${resolvedOutDir}${path.sep}`) &&
                existsSync(candidate),
        );
}

async function rewriteRssFile(
    siteConfig: SiteConfig,
    options: RssAssetPluginOptions,
): Promise<void> {
    const feedPath = path.join(
        siteConfig.outDir,
        options.filename ?? "feed.rss",
    );

    if (!existsSync(feedPath)) return;

    const feedXml = await fs.readFile(feedPath, "utf8");
    const rewrittenFeed = rewriteRssFeedAssets(feedXml, (articleUrl) => {
        const pageFile = resolvePageFile(
            siteConfig.outDir,
            articleUrl,
            options.baseUrl,
            siteConfig.site.base,
        );

        return pageFile ? readFileSync(pageFile, "utf8") : undefined;
    });

    if (rewrittenFeed !== feedXml) {
        await fs.writeFile(feedPath, rewrittenFeed);
    }
}

export function RssAssetPlugin(options: RssAssetPluginOptions) {
    let configured = false;

    return {
        name: "vitepress-rss-absolute-assets",
        enforce: "post" as const,
        configResolved(config: unknown) {
            if (configured) return;

            const vitepress = (config as ResolvedVitePressConfig).vitepress;
            if (!vitepress) return;

            configured = true;
            const generateRss = vitepress.buildEnd;

            vitepress.buildEnd = async (siteConfig) => {
                await generateRss?.(siteConfig);
                await rewriteRssFile(siteConfig, options);
            };
        },
    };
}

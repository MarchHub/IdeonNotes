import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import type { SiteConfig } from "vitepress";
import {
    assertNoPageRouteCollisions,
    pageIdToOutputFile,
    pageIdToPublicHref,
    rewritePageId,
    sourceHrefToPageId,
} from "./route-paths.ts";

interface ResolvedVitePressConfig extends ResolvedConfig {
    vitepress?: SiteConfig;
}

function normalizeBase(base: string): string {
    const normalized = `/${base}`.replace(/\/+/g, "/");
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function withBase(href: string, base: string): string {
    const normalizedBase = normalizeBase(base);

    if (normalizedBase === "/") return href;
    if (href === "/") return normalizedBase;

    return `${normalizedBase.replace(/\/$/, "")}${href}`;
}

function removeBase(pathname: string, base: string): string | undefined {
    const normalizedBase = normalizeBase(base);

    if (normalizedBase === "/") return pathname;

    const baseWithoutTrailingSlash = normalizedBase.replace(/\/$/, "");
    if (pathname === baseWithoutTrailingSlash) return "/";
    if (!pathname.startsWith(normalizedBase)) return undefined;

    return pathname.slice(baseWithoutTrailingSlash.length);
}

function encodeHref(href: string): string {
    return encodeURI(href);
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function renderLegacyRouteRedirect(targetHref: string): string {
    const encodedTarget = encodeHref(targetHref);
    const escapedTarget = escapeHtml(encodedTarget);
    const scriptTarget = JSON.stringify(encodedTarget).replaceAll(
        "<",
        "\\u003c",
    );

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${escapedTarget}">
  <meta http-equiv="refresh" content="0; url=${escapedTarget}">
  <title>页面已迁移</title>
</head>
<body>
  <p>页面已迁移至 <a href="${escapedTarget}">${escapedTarget}</a>。</p>
  <script>location.replace(${scriptTarget} + location.search + location.hash)</script>
</body>
</html>
`;
}

function resolveOutputFile(outDir: string, relativeFile: string): string {
    const resolvedOutDir = path.resolve(outDir);
    const outputFile = path.resolve(resolvedOutDir, relativeFile);

    if (!outputFile.startsWith(`${resolvedOutDir}${path.sep}`)) {
        throw new Error(`拒绝在构建目录之外生成历史跳转页：${relativeFile}`);
    }

    return outputFile;
}

export async function writeLegacyPageRedirects(
    siteConfig: SiteConfig,
): Promise<number> {
    assertNoPageRouteCollisions(siteConfig.pages);

    let redirectCount = 0;

    for (const sourcePageId of siteConfig.pages) {
        if (rewritePageId(sourcePageId) === sourcePageId) continue;

        const outputFile = resolveOutputFile(
            siteConfig.outDir,
            pageIdToOutputFile(sourcePageId),
        );
        const targetHref = withBase(
            pageIdToPublicHref(sourcePageId, siteConfig.cleanUrls),
            siteConfig.site.base,
        );

        await fs.mkdir(path.dirname(outputFile), { recursive: true });
        await fs.writeFile(
            outputFile,
            renderLegacyRouteRedirect(targetHref),
            "utf8",
        );
        redirectCount += 1;
    }

    if (redirectCount > 0) {
        siteConfig.logger.info(
            `generated ${redirectCount} legacy whitespace route redirects`,
        );
    }

    return redirectCount;
}

export function PageRoutePlugin(): Plugin {
    let siteConfig: SiteConfig | undefined;
    let sourcePages = new Set<string>();

    return {
        name: "vitepress-page-route-contract",
        enforce: "pre",
        configResolved(config) {
            siteConfig = (config as ResolvedVitePressConfig).vitepress;
            if (!siteConfig) return;

            assertNoPageRouteCollisions(siteConfig.pages);
            sourcePages = new Set(siteConfig.pages);
        },
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                if (!request.url || !siteConfig) {
                    next();
                    return;
                }

                let requestUrl: URL;

                try {
                    requestUrl = new URL(request.url, "http://vitepress.local");
                } catch {
                    next();
                    return;
                }

                let decodedPath: string;

                try {
                    decodedPath = decodeURI(requestUrl.pathname);
                } catch {
                    next();
                    return;
                }

                const pathWithoutBase = removeBase(
                    decodedPath,
                    siteConfig.site.base,
                );

                if (pathWithoutBase === undefined) {
                    next();
                    return;
                }

                const sourcePageId = sourceHrefToPageId(pathWithoutBase);

                if (
                    !sourcePages.has(sourcePageId) ||
                    rewritePageId(sourcePageId) === sourcePageId
                ) {
                    next();
                    return;
                }

                const targetHref = withBase(
                    pageIdToPublicHref(
                        sourcePageId,
                        siteConfig.cleanUrls,
                    ),
                    siteConfig.site.base,
                );

                response.statusCode = 308;
                response.setHeader(
                    "Location",
                    `${encodeHref(targetHref)}${requestUrl.search}`,
                );
                response.end();
            });
        },
    };
}

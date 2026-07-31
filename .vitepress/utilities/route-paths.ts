const MARKDOWN_EXTENSION_PATTERN = /\.md$/i;
const HTML_EXTENSION_PATTERN = /\.html$/i;
const WHITESPACE_PATTERN = /\s+/gu;

export interface PageRouteIndex {
    sourceToTarget: ReadonlyMap<string, string>;
    targetToSource: ReadonlyMap<string, string>;
}

export function normalizePageId(pageId: string): string {
    return pageId.replace(/\\/g, "/").replace(/^\/+/, "");
}

function rewritePathSegment(segment: string): string {
    const extension = segment.match(/\.(?:md|html)$/i)?.[0] ?? "";
    const name = extension.length > 0 ? segment.slice(0, -extension.length) : segment;

    return `${name.trim().replace(WHITESPACE_PATTERN, "-")}${extension}`;
}

export function rewritePageId(pageId: string): string {
    return normalizePageId(pageId)
        .split("/")
        .map(rewritePathSegment)
        .join("/");
}

export function pageIdToPublicHref(
    pageId: string,
    cleanUrls = true,
): string {
    let route = rewritePageId(pageId);

    if (cleanUrls) {
        route = route
            .replace(/(^|\/)index\.md$/i, "$1")
            .replace(MARKDOWN_EXTENSION_PATTERN, "");
    } else {
        route = route
            .replace(/(^|\/)index\.md$/i, "$1index.html")
            .replace(MARKDOWN_EXTENSION_PATTERN, ".html");
    }

    return `/${route}`.replace(/\/+/g, "/");
}

export function sourceHrefToPageId(href: string): string {
    const pathOnly = href.replace(/[?#].*$/, "");
    let pageId = normalizePageId(pathOnly);

    if (pageId.length === 0) return "index.md";
    if (pageId.endsWith("/")) return `${pageId}index.md`;
    if (MARKDOWN_EXTENSION_PATTERN.test(pageId)) return pageId;
    if (HTML_EXTENSION_PATTERN.test(pageId)) {
        return pageId.replace(HTML_EXTENSION_PATTERN, ".md");
    }

    return `${pageId}.md`;
}

function collisionMessage(
    target: string,
    sources: readonly string[],
): string {
    return [
        `公开路由冲突：${target}`,
        ...sources.map((source) => `- ${source}`),
        "请明确调整其中一个文件或目录名；不会自动追加序号。",
    ].join("\n");
}

export function createPageRouteIndex(
    pageIds: Iterable<string>,
): PageRouteIndex {
    const sourceToTarget = new Map<string, string>();
    const targetToSource = new Map<string, string>();

    for (const rawPageId of pageIds) {
        const source = normalizePageId(rawPageId);
        const target = rewritePageId(source);
        const existingSource = targetToSource.get(target);

        if (existingSource !== undefined && existingSource !== source) {
            throw new Error(
                collisionMessage(target, [existingSource, source]),
            );
        }

        sourceToTarget.set(source, target);
        targetToSource.set(target, source);
    }

    return { sourceToTarget, targetToSource };
}

export function assertNoPageRouteCollisions(
    pageIds: Iterable<string>,
): void {
    createPageRouteIndex(pageIds);
}

export function createPageRouteRewriter(): (pageId: string) => string {
    const sourceByTarget = new Map<string, string>();

    return (rawPageId) => {
        const source = normalizePageId(rawPageId);
        const target = rewritePageId(source);
        const existingSource = sourceByTarget.get(target);

        if (existingSource !== undefined && existingSource !== source) {
            throw new Error(
                collisionMessage(target, [existingSource, source]),
            );
        }

        sourceByTarget.set(target, source);
        return target;
    };
}

export function pageIdToOutputFile(pageId: string): string {
    const normalized = normalizePageId(pageId);

    if (!MARKDOWN_EXTENSION_PATTERN.test(normalized)) {
        throw new Error(`页面 ID 必须以 .md 结尾：${pageId}`);
    }

    return normalized.replace(MARKDOWN_EXTENSION_PATTERN, ".html");
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import fg from "fast-glob";

import { renderLegacyRouteRedirect } from "../../.vitepress/utilities/page-route-plugin.ts";
import {
    assertNoPageRouteCollisions,
    createPageRouteIndex,
    pageIdToOutputFile,
    pageIdToPublicHref,
    rewritePageId,
    sourceHrefToPageId,
} from "../../.vitepress/utilities/route-paths.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const markdownIgnore = [
    ".vitepress/cache/**",
    ".vitepress/dist/**",
    "dev/**",
    "node_modules/**",
];

async function currentMarkdownPageIds(): Promise<string[]> {
    return fg("**/*.md", {
        cwd: projectRoot,
        ignore: markdownIgnore,
        onlyFiles: true,
    });
}

function markdownPageDestinations(markdown: string): string[] {
    const destinations: string[] = [];
    const linkPattern = /(?<!!)\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;

    for (const match of markdown.matchAll(linkPattern)) {
        destinations.push(match[1] ?? match[2]);
    }

    return destinations;
}

function isLocalMarkdownDestination(destination: string): boolean {
    const pathOnly = destination.split(/[?#]/, 1)[0];

    return (
        !/^[a-z][a-z\d+.-]*:/i.test(pathOnly) &&
        !pathOnly.startsWith("//") &&
        /\.md$/i.test(pathOnly)
    );
}

test("rewrites whitespace per segment without changing visible source names", () => {
    const source = "posts/软件工程/001 面向对象/鸭子 类型.md";

    assert.equal(
        rewritePageId(source),
        "posts/软件工程/001-面向对象/鸭子-类型.md",
    );
    assert.equal(source, "posts/软件工程/001 面向对象/鸭子 类型.md");
});

test("normalizes consecutive unicode whitespace and keeps existing characters", () => {
    assert.equal(
        rewritePageId(" posts /A\t\u3000B/Already-命名.md "),
        "posts/A-B/Already-命名.md",
    );
});

test("converts content-loader source hrefs back to real markdown page ids", () => {
    assert.equal(sourceHrefToPageId("/"), "index.md");
    assert.equal(sourceHrefToPageId("/guide/"), "guide/index.md");
    assert.equal(sourceHrefToPageId("/posts/文章"), "posts/文章.md");
    assert.equal(
        sourceHrefToPageId("/posts/文章.html?from=archive#摘要"),
        "posts/文章.md",
    );
});

test("preserves clean-url index and build output rules", () => {
    assert.equal(pageIdToPublicHref("guide/index.md"), "/guide/");
    assert.equal(pageIdToPublicHref("guide/入门 文档.md"), "/guide/入门-文档");
    assert.equal(
        pageIdToPublicHref("guide/入门 文档.md", false),
        "/guide/入门-文档.html",
    );
    assert.equal(
        pageIdToOutputFile("guide/入门 文档.md"),
        "guide/入门 文档.html",
    );
});

test("rejects route collisions instead of appending an implicit suffix", () => {
    assert.throws(
        () => createPageRouteIndex(["guide/A B.md", "guide/A-B.md"]),
        /公开路由冲突：guide\/A-B\.md/,
    );
});

test("the current markdown inventory has no rewritten route collisions", async () => {
    const pageIds = await currentMarkdownPageIds();

    assert.doesNotThrow(() => assertNoPageRouteCollisions(pageIds));
});

test("markdown page links do not use legacy whitespace source routes", async () => {
    const pageIds = await currentMarkdownPageIds();
    const invalidLinks: string[] = [];

    await Promise.all(
        pageIds.map(async (pageId) => {
            const markdown = await readFile(path.join(projectRoot, pageId), "utf8");

            for (const destination of markdownPageDestinations(markdown)) {
                if (!isLocalMarkdownDestination(destination)) continue;

                const pathOnly = destination.split(/[?#]/, 1)[0];
                let decodedPath = pathOnly;

                try {
                    decodedPath = decodeURI(pathOnly);
                } catch {
                    // A malformed URI is reported by the same whitespace contract below.
                }

                if (/\s/u.test(decodedPath)) {
                    invalidLinks.push(`${pageId}: ${destination}`);
                }
            }
        }),
    );

    assert.deepEqual(invalidLinks, []);
});

test("legacy redirect points only to the canonical route", () => {
    const canonicalRoute = "/posts/软件工程/001-面向对象/鸭子类型";
    const html = renderLegacyRouteRedirect(canonicalRoute);
    const encodedCanonicalRoute = encodeURI(canonicalRoute);

    assert.match(html, new RegExp(`rel="canonical" href="${encodedCanonicalRoute}"`));
    assert.match(html, new RegExp(`location\\.replace\\("${encodedCanonicalRoute}"`));
    assert.doesNotMatch(html, /%20|001 面向对象/);
});

test("knowledge graph page paths are canonical and whitespace-free", async () => {
    const graph = JSON.parse(
        await readFile(path.join(projectRoot, "public/phaseshard.json"), "utf8"),
    ) as { nodes: Array<{ id: string; path: string }> };

    for (const node of graph.nodes) {
        assert.equal(node.path, `/${rewritePageId(node.path)}`, node.id);
        assert.doesNotMatch(node.path, /\s|%20/i, node.id);
    }
});

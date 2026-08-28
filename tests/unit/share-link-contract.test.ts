import assert from "node:assert/strict";
import test from "node:test";
import {
    normalizeCanonicalPath,
    parseShareLinkManifest,
    shareIdToShortUrl,
} from "../../.vitepress/shared/share-link-contract.ts";
import { baseUrl } from "../../.vitepress/shared/site-config.ts";
import { createPageShareInput } from "../../.vitepress/theme/services/page-share-context.ts";

test("canonical path 归一化中文、编码、query、hash 与 html", () => {
    assert.equal(
        normalizeCanonicalPath("/posts/%E4%B8%AD%E6%96%87.html?q=1#x"),
        "/posts/中文",
    );
    assert.equal(normalizeCanonicalPath("/posts/目录/index.html"), "/posts/目录/");
});

test("manifest schema 拒绝错误域名和短 ID", () => {
    const base = {
        version: 1,
        registryHash: "a".repeat(64),
        shortOrigin: baseUrl,
        byCanonicalPath: { "/posts/中文": "23456789ab" },
    };

    assert.deepEqual(parseShareLinkManifest(base), base);
    assert.throws(() => parseShareLinkManifest({ ...base, shortOrigin: "https://bad.test" }));
    assert.throws(() => parseShareLinkManifest({ ...base, byCanonicalPath: { "/x": "invalid" } }));
    assert.throws(() => parseShareLinkManifest({
        ...base,
        byCanonicalPath: { "/x": "23456789ab", "/y": "23456789ab" },
    }));
    assert.equal(shareIdToShortUrl("23456789ab"), `${baseUrl}/s/23456789ab`);
});

test("文章原始链接与短 ID 链接都使用 baseUrl 前缀", () => {
    const page = createPageShareInput({
        routePath: "/posts/中文?q=1#section",
        title: "中文",
    });

    assert.equal(page.canonicalUrl, `${baseUrl}/posts/%E4%B8%AD%E6%96%87`);
    assert.ok(shareIdToShortUrl("23456789ab").startsWith(`${baseUrl}/`));
});

import assert from "node:assert/strict";
import test from "node:test";
import { assertNoPublishedShortLinks } from "../../.vitepress/utilities/share-link-artifact-check.ts";
import { parseShortLinkDeploymentManifest } from "../../.vitepress/utilities/short-link-pages.ts";

test("部署 manifest 拒绝外域 target", () => {
    assert.throws(() => parseShortLinkDeploymentManifest({
        version: 1,
        registryHash: "a".repeat(64),
        contentOrigin: "https://yuufrag.machillka.com",
        records: { "23456789ab": { status: "active", target: "https://evil.test" } },
    }));
});

test("sitemap、RSS、搜索和图谱内容不得含短链", () => {
    assert.doesNotThrow(() => assertNoPublishedShortLinks([{ file: "sitemap.xml", content: "https://yuufrag.machillka.com/posts/x" }]));
    assert.throws(() => assertNoPublishedShortLinks([{ file: "feed.rss", content: "https://yuufrag.machillka.com/s/23456789ab" }]));
});

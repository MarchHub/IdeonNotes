import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
    publishShortLinkSite,
    renderActiveShortLinkPage,
    renderGoneShortLinkPage,
} from "../../.vitepress/utilities/short-link-pages.ts";

test("active HTML 安全跳转并提供 canonical、refresh、JS 和无 JS 链接", () => {
    const html = renderActiveShortLinkPage({
        target: "https://yuufrag.machillka.com/posts/%E4%B8%AD%E6%96%87",
        metadata: { title: "标题 </script>", description: "描述 & 更多" },
    });
    assert.match(html, /noindex,follow/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /http-equiv="refresh"/);
    assert.match(html, /location\.replace/);
    assert.match(html, /<a rel="nofollow"/);
    assert.doesNotMatch(html, /标题 <\/script>/);
});

test("active HTML 拒绝开放重定向、query 与 hash", () => {
    for (const target of [
        "https://evil.test/x",
        "https://yuufrag.machillka.com/x?target=https://evil.test",
        "https://yuufrag.machillka.com/x#evil",
    ]) {
        assert.throws(() => renderActiveShortLinkPage({
            target,
            metadata: { title: "x", description: "x" },
        }));
    }
    assert.match(renderGoneShortLinkPage(), /noindex,nofollow/);
});

test("发布器生成 active、gone、404 和同 hash manifest，并原子替换旧产物", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "yuufrag-shortlinks-"));
    const outputDir = path.join(root, "out");
    const contentDistDir = path.join(root, "content");
    await fs.mkdir(path.join(contentDistDir, "posts"), { recursive: true });
    await fs.writeFile(path.join(contentDistDir, "posts", "中文.html"), "ok");
    await fs.mkdir(outputDir);
    await fs.writeFile(path.join(outputDir, "old.txt"), "old");

    try {
        const result = await publishShortLinkSite({
            registry: {
                version: 1,
                records: {
                    "23456789ab": { pageId: "posts/中文.md", status: "active" },
                    "23456789ac": { pageId: "posts/旧文.md", status: "gone" },
                },
            },
            registryHash: "b".repeat(64),
            outputDir,
            contentDistDir,
            metadataForPageId: async () => ({ title: "中文", description: "描述" }),
        });
        assert.equal(result.manifest.registryHash, "b".repeat(64));
        assert.equal(result.activeCount, 1);
        assert.equal(result.goneCount, 1);
        await fs.access(path.join(outputDir, "s", "23456789ab", "index.html"));
        await fs.access(path.join(outputDir, "s", "23456789ac", "index.html"));
        await fs.access(path.join(outputDir, "404.html"));
        await assert.rejects(fs.access(path.join(outputDir, "old.txt")));
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

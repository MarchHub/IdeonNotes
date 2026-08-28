import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadShareLinkManifestSource } from "../../.vitepress/utilities/share-link-manifest-plugin.ts";

test("manifest 插件只接受有效的中间 manifest", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "yuufrag-manifest-plugin-"));
    const file = path.join(root, "manifest.json");
    try {
        await fs.writeFile(file, JSON.stringify({
            version: 1,
            registryHash: "a".repeat(64),
            shortOrigin: "https://yuufrag.machillka.com",
            byCanonicalPath: { "/posts/中文": "23456789ab" },
        }));
        assert.match(await loadShareLinkManifestSource(file), /中文/);
        await fs.writeFile(file, JSON.stringify({ version: 2 }));
        await assert.rejects(loadShareLinkManifestSource(file));
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

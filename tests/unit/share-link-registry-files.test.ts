import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    checkShareLinkFiles,
    loadShareLinkRegistry,
    prepareShareLinkFiles,
} from "../../.vitepress/utilities/share-link-registry-files.ts";
import { generateStaticShareId } from "../../.vitepress/utilities/share-links.ts";

async function withTemporaryFiles(
    callback: (input: {
        generatedRegistryFile: string;
        manifestFile: string;
    }) => Promise<void>,
): Promise<void> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "yuufrag-share-links-"));

    try {
        await callback({
            generatedRegistryFile: path.join(root, "generated/share-links.json"),
            manifestFile: path.join(root, "generated/share-links-manifest.json"),
        });
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

test("prepare rebuilds the registry from current pages only", async () => {
    await withTemporaryFiles(async ({ generatedRegistryFile, manifestFile }) => {
        await fs.mkdir(path.dirname(generatedRegistryFile), { recursive: true });
        await fs.writeFile(
            generatedRegistryFile,
            JSON.stringify({
                version: 1,
                records: {
                    k7m2p9x4qd: {
                        pageId: "posts/已删除.md",
                        status: "active",
                    },
                },
            }),
            "utf8",
        );

        const pageIds = ["posts/B.md", "posts/中文.md", "posts/A.md"];
        const result = await prepareShareLinkFiles({
            generatedRegistryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const registry = await loadShareLinkRegistry(generatedRegistryFile);
        const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8")) as {
            byCanonicalPath: Record<string, string>;
            shortOrigin: string;
        };

        assert.equal(result.generatedCount, 3);
        assert.equal(result.generatedRegistryChanged, true);
        assert.equal(Object.keys(registry.records).length, 3);
        assert.equal(registry.records.k7m2p9x4qd, undefined);
        assert.equal(
            registry.records[generateStaticShareId("posts/A.md")].pageId,
            "posts/A.md",
        );
        assert.equal(Object.keys(manifest.byCanonicalPath).length, 3);
        assert.equal(manifest.shortOrigin, "https://yuufrag.machillka.com");
    });
});

test("repeated prepare is stable and does not rewrite unchanged files", async () => {
    await withTemporaryFiles(async ({ generatedRegistryFile, manifestFile }) => {
        const input = {
            generatedRegistryFile,
            generatedManifestFile: manifestFile,
            pageIds: ["posts/A.md"],
        };
        await prepareShareLinkFiles(input);
        const registryBefore = await fs.readFile(generatedRegistryFile, "utf8");
        const manifestBefore = await fs.readFile(manifestFile, "utf8");
        const second = await prepareShareLinkFiles(input);

        assert.equal(second.generatedRegistryChanged, false);
        assert.equal(second.manifestChanged, false);
        assert.equal(await fs.readFile(generatedRegistryFile, "utf8"), registryBefore);
        assert.equal(await fs.readFile(manifestFile, "utf8"), manifestBefore);
    });
});

test("check validates deterministic generation without writing files", async () => {
    await withTemporaryFiles(async ({ generatedRegistryFile, manifestFile }) => {
        const result = await checkShareLinkFiles({ pageIds: ["posts/A.md"] });

        assert.equal(result.activeCount, 1);
        assert.equal(result.goneCount, 0);
        await assert.rejects(() => fs.access(generatedRegistryFile));
        await assert.rejects(() => fs.access(manifestFile));
    });
});

test("prepare refuses to run while the generated registry lock exists", async () => {
    await withTemporaryFiles(async ({ generatedRegistryFile, manifestFile }) => {
        await fs.mkdir(path.dirname(generatedRegistryFile), { recursive: true });
        await fs.writeFile(
            `${generatedRegistryFile}.lock`,
            "other-process\n",
            "utf8",
        );

        await assert.rejects(
            () =>
                prepareShareLinkFiles({
                    generatedRegistryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/A.md"],
                }),
            /分享注册表正被另一个进程更新/,
        );
        await assert.rejects(() => fs.access(generatedRegistryFile));
    });
});

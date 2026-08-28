import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    checkShareLinkFiles,
    loadShareLinkRegistry,
    prepareShareLinkFiles,
} from "../../.vitepress/utilities/share-link-registry-files.ts";

async function withTemporaryFiles(
    callback: (input: {
        root: string;
        baseRegistryFile: string;
        generatedRegistryFile: string;
        manifestFile: string;
    }) => Promise<void>,
): Promise<void> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "yuufrag-share-links-"));

    try {
        await callback({
            root,
            baseRegistryFile: path.join(root, "data/share-links.json"),
            generatedRegistryFile: path.join(root, "generated/share-links.json"),
            manifestFile: path.join(root, "generated/share-links-manifest.json"),
        });
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

function hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

test("prepare derives missing ids without modifying the base registry", async () => {
    await withTemporaryFiles(async ({
        baseRegistryFile,
        generatedRegistryFile,
        manifestFile,
    }) => {
        const pageIds = ["posts/B.md", "posts/中文.md", "posts/A.md"];
        const baseRegistryContent = `${JSON.stringify(
            {
                version: 1,
                records: {
                    k7m2p9x4qd: { pageId: "posts/A.md", status: "active" },
                },
            },
            null,
            2,
        )}\n`;
        await fs.mkdir(path.dirname(baseRegistryFile), { recursive: true });
        await fs.writeFile(baseRegistryFile, baseRegistryContent, "utf8");

        const first = await prepareShareLinkFiles({
            baseRegistryFile,
            generatedRegistryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const registry = await loadShareLinkRegistry(generatedRegistryFile);
        const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8")) as {
            byCanonicalPath: Record<string, string>;
            shortOrigin: string;
        };

        assert.equal(first.added.length, 2);
        assert.equal(first.unchangedCount, 1);
        assert.equal(first.generatedRegistryChanged, true);
        assert.equal(first.manifestChanged, true);
        assert.equal(Object.keys(registry.records).length, 3);
        assert.equal(Object.keys(manifest.byCanonicalPath).length, 3);
        assert.equal(manifest.shortOrigin, "https://yuufrag.machillka.com");
        assert.ok(manifest.byCanonicalPath["/posts/中文"]);
        assert.equal(registry.records.k7m2p9x4qd.pageId, "posts/A.md");
        assert.equal(await fs.readFile(baseRegistryFile, "utf8"), baseRegistryContent);
    });
});

test("repeated prepare is stable and does not rewrite unchanged files", async () => {
    await withTemporaryFiles(async ({
        baseRegistryFile,
        generatedRegistryFile,
        manifestFile,
    }) => {
        const pageIds = ["posts/A.md"];
        await prepareShareLinkFiles({
            baseRegistryFile,
            generatedRegistryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const registryBefore = await fs.readFile(generatedRegistryFile, "utf8");
        const manifestBefore = await fs.readFile(manifestFile, "utf8");
        const second = await prepareShareLinkFiles({
            baseRegistryFile,
            generatedRegistryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });

        assert.equal(second.generatedRegistryChanged, false);
        assert.equal(second.manifestChanged, false);
        assert.equal(await fs.readFile(generatedRegistryFile, "utf8"), registryBefore);
        assert.equal(await fs.readFile(manifestFile, "utf8"), manifestBefore);
    });
});

test("check is read-only", async () => {
    await withTemporaryFiles(async ({
        baseRegistryFile,
        generatedRegistryFile,
        manifestFile,
    }) => {
        const pageIds = ["posts/A.md"];
        await prepareShareLinkFiles({
            baseRegistryFile,
            generatedRegistryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const before = await fs.readFile(generatedRegistryFile, "utf8");

        const result = await checkShareLinkFiles({
            registryFile: generatedRegistryFile,
            pageIds,
        });

        assert.equal(result.activeCount, 1);
        assert.equal(result.goneCount, 0);
        assert.equal(await fs.readFile(generatedRegistryFile, "utf8"), before);
    });
});

test("prepare refuses to run while the registry lock exists", async () => {
    await withTemporaryFiles(async ({
        baseRegistryFile,
        generatedRegistryFile,
        manifestFile,
    }) => {
        await fs.mkdir(path.dirname(generatedRegistryFile), { recursive: true });
        await fs.writeFile(
            `${generatedRegistryFile}.lock`,
            "other-process\n",
            "utf8",
        );

        await assert.rejects(
            () =>
                prepareShareLinkFiles({
                    baseRegistryFile,
                    generatedRegistryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/A.md"],
                }),
            /分享注册表正被另一个进程更新/,
        );
        await assert.rejects(() => fs.access(baseRegistryFile));
        await assert.rejects(() => fs.access(generatedRegistryFile));
    });
});

test("prepare refuses to replace a registry changed outside its lock", async () => {
    await withTemporaryFiles(async ({
        baseRegistryFile,
        generatedRegistryFile,
        manifestFile,
    }) => {
        await fs.mkdir(path.dirname(baseRegistryFile), { recursive: true });
        await fs.writeFile(
            baseRegistryFile,
            JSON.stringify({ version: 1, records: {} }),
            "utf8",
        );

        const changedContent = JSON.stringify({
            version: 1,
            records: {
                k7m2p9x4qd: { pageId: "posts/A.md", status: "active" },
            },
        });
        const originalReadFile = fs.readFile.bind(fs);
        let registryReadCount = 0;

        const readTextIfExists = async (file: string): Promise<string | undefined> => {
            if (file === baseRegistryFile) {
                registryReadCount += 1;
                if (registryReadCount === 3) {
                    await fs.writeFile(baseRegistryFile, changedContent, "utf8");
                }
            }

            try {
                return await originalReadFile(file, "utf8");
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    return undefined;
                }

                throw error;
            }
        };

        await assert.rejects(
            () =>
                prepareShareLinkFiles({
                    baseRegistryFile,
                    generatedRegistryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/A.md"],
                    readTextIfExists,
                }),
            /基础分享注册表在 prepare 期间已被修改/,
        );
        assert.equal(
            hash(await fs.readFile(baseRegistryFile, "utf8")),
            hash(changedContent),
        );
        await assert.rejects(() => fs.access(generatedRegistryFile));
    });
});

test("active records that no longer point to a page fail before writing", async () => {
    await withTemporaryFiles(async ({
        baseRegistryFile,
        generatedRegistryFile,
        manifestFile,
    }) => {
        await fs.mkdir(path.dirname(baseRegistryFile), { recursive: true });
        await fs.writeFile(
            baseRegistryFile,
            JSON.stringify({
                version: 1,
                records: {
                    k7m2p9x4qd: { pageId: "posts/旧页面.md", status: "active" },
                },
            }),
            "utf8",
        );
        const before = await fs.readFile(baseRegistryFile, "utf8");

        await assert.rejects(
            () =>
                prepareShareLinkFiles({
                    baseRegistryFile,
                    generatedRegistryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/新页面.md"],
                }),
            /active 分享 ID 指向不存在页面：k7m2p9x4qd -> posts\/旧页面\.md/,
        );
        assert.equal(await fs.readFile(baseRegistryFile, "utf8"), before);
        await assert.rejects(() => fs.access(generatedRegistryFile));
    });
});

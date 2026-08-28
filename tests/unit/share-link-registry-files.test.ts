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
        registryFile: string;
        manifestFile: string;
    }) => Promise<void>,
): Promise<void> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "yuufrag-share-links-"));

    try {
        await callback({
            root,
            registryFile: path.join(root, "data/share-links.json"),
            manifestFile: path.join(root, "generated/share-links-manifest.json"),
        });
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

function hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

test("prepare writes only missing ids and a query manifest", async () => {
    await withTemporaryFiles(async ({ registryFile, manifestFile }) => {
        const pageIds = ["posts/B.md", "posts/中文.md", "posts/A.md"];
        const first = await prepareShareLinkFiles({
            registryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const registry = await loadShareLinkRegistry(registryFile);
        const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8")) as {
            byCanonicalPath: Record<string, string>;
            shortOrigin: string;
        };

        assert.equal(first.added.length, 3);
        assert.equal(first.registryChanged, true);
        assert.equal(first.manifestChanged, true);
        assert.equal(Object.keys(registry.records).length, 3);
        assert.equal(Object.keys(manifest.byCanonicalPath).length, 3);
        assert.equal(manifest.shortOrigin, "https://yuufrag.machillka.com");
        assert.ok(manifest.byCanonicalPath["/posts/中文"]);
    });
});

test("repeated prepare is stable and does not rewrite unchanged files", async () => {
    await withTemporaryFiles(async ({ registryFile, manifestFile }) => {
        const pageIds = ["posts/A.md"];
        await prepareShareLinkFiles({
            registryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const registryBefore = await fs.readFile(registryFile, "utf8");
        const manifestBefore = await fs.readFile(manifestFile, "utf8");
        const second = await prepareShareLinkFiles({
            registryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });

        assert.equal(second.added.length, 0);
        assert.equal(second.registryChanged, false);
        assert.equal(second.manifestChanged, false);
        assert.equal(await fs.readFile(registryFile, "utf8"), registryBefore);
        assert.equal(await fs.readFile(manifestFile, "utf8"), manifestBefore);
    });
});

test("check is read-only", async () => {
    await withTemporaryFiles(async ({ registryFile, manifestFile }) => {
        const pageIds = ["posts/A.md"];
        await prepareShareLinkFiles({
            registryFile,
            generatedManifestFile: manifestFile,
            pageIds,
        });
        const before = await fs.readFile(registryFile, "utf8");

        const result = await checkShareLinkFiles({ registryFile, pageIds });

        assert.equal(result.activeCount, 1);
        assert.equal(result.goneCount, 0);
        assert.equal(await fs.readFile(registryFile, "utf8"), before);
    });
});

test("prepare refuses to run while the registry lock exists", async () => {
    await withTemporaryFiles(async ({ registryFile, manifestFile }) => {
        await fs.mkdir(path.dirname(registryFile), { recursive: true });
        await fs.writeFile(`${registryFile}.lock`, "other-process\n", "utf8");

        await assert.rejects(
            () =>
                prepareShareLinkFiles({
                    registryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/A.md"],
                }),
            /分享注册表正被另一个进程更新/,
        );
        await assert.rejects(() => fs.access(registryFile));
    });
});

test("prepare refuses to replace a registry changed outside its lock", async () => {
    await withTemporaryFiles(async ({ registryFile, manifestFile }) => {
        await fs.mkdir(path.dirname(registryFile), { recursive: true });
        await fs.writeFile(
            registryFile,
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
            if (file === registryFile) {
                registryReadCount += 1;
                if (registryReadCount === 3) {
                    await fs.writeFile(registryFile, changedContent, "utf8");
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
                    registryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/A.md"],
                    readTextIfExists,
                }),
            /分享注册表在 prepare 期间已被修改/,
        );
        assert.equal(hash(await fs.readFile(registryFile, "utf8")), hash(changedContent));
    });
});

test("active records that no longer point to a page fail before writing", async () => {
    await withTemporaryFiles(async ({ registryFile, manifestFile }) => {
        await fs.mkdir(path.dirname(registryFile), { recursive: true });
        await fs.writeFile(
            registryFile,
            JSON.stringify({
                version: 1,
                records: {
                    k7m2p9x4qd: { pageId: "posts/旧页面.md", status: "active" },
                },
            }),
            "utf8",
        );
        const before = await fs.readFile(registryFile, "utf8");

        await assert.rejects(
            () =>
                prepareShareLinkFiles({
                    registryFile,
                    generatedManifestFile: manifestFile,
                    pageIds: ["posts/新页面.md"],
                }),
            /active 分享 ID 指向不存在页面：k7m2p9x4qd -> posts\/旧页面\.md/,
        );
        assert.equal(await fs.readFile(registryFile, "utf8"), before);
    });
});

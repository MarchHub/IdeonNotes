import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
    SHARE_LINK_SHORT_ORIGIN,
    type ShareLinkManifest,
} from "../shared/share-link-contract.ts";
import {
    createShareLinkIndex,
    generateShareLinks,
    resolveCanonicalHref,
    type GenerateShareLinksResult,
    type ShareId,
    type ShareLinkRegistry,
} from "./share-links.ts";

export {
    SHARE_LINK_SHORT_ORIGIN,
    type ShareLinkManifest,
} from "../shared/share-link-contract.ts";

export interface ShareLinkFilePaths {
    generatedRegistryFile: string;
    generatedManifestFile: string;
}

export interface PrepareShareLinkFilesInput extends ShareLinkFilePaths {
    pageIds: Iterable<string>;
}

export interface PrepareShareLinkFilesResult extends GenerateShareLinksResult {
    generatedRegistryChanged: boolean;
    manifestChanged: boolean;
    manifest: ShareLinkManifest;
}

export interface CheckShareLinkFilesInput {
    pageIds: Iterable<string>;
}

export interface CheckShareLinkFilesResult {
    activeCount: number;
    goneCount: number;
}

function defaultRegistry(): ShareLinkRegistry {
    return { version: 1, records: {} };
}

function serializeJson(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function hashContent(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
}

function lockFileFor(registryFile: string): string {
    return `${registryFile}.lock`;
}

function tempFileFor(file: string): string {
    return `${file}.${process.pid}.${Date.now()}.tmp`;
}

async function readTextIfExists(file: string): Promise<string | undefined> {
    try {
        return await fs.readFile(file, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return undefined;
        }

        throw error;
    }
}

export async function loadShareLinkRegistry(
    registryFile: string,
): Promise<ShareLinkRegistry> {
    return loadShareLinkRegistryFromReader(registryFile);
}

async function loadShareLinkRegistryFromReader(
    registryFile: string,
): Promise<ShareLinkRegistry> {
    const content = await readTextIfExists(registryFile);

    if (content === undefined) return defaultRegistry();

    try {
        return JSON.parse(content) as ShareLinkRegistry;
    } catch (error) {
        throw new Error(
            `无法解析分享注册表 ${registryFile}: ${(error as Error).message}`,
        );
    }
}

async function acquireRegistryLock(registryFile: string): Promise<() => Promise<void>> {
    const lockFile = lockFileFor(registryFile);
    await fs.mkdir(path.dirname(lockFile), { recursive: true });

    let handle: Awaited<ReturnType<typeof fs.open>>;

    try {
        handle = await fs.open(lockFile, "wx");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            throw new Error(`分享注册表正被另一个进程更新：${lockFile}`);
        }

        throw error;
    }

    try {
        await handle.writeFile(`${process.pid}\n`, "utf8");
    } catch (error) {
        await handle.close();
        await fs.unlink(lockFile).catch(() => undefined);
        throw error;
    }

    return async () => {
        await handle.close();
        await fs.unlink(lockFile).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
        });
    };
}

async function writeTextAtomicallyIfChanged(
    file: string,
    content: string,
): Promise<boolean> {
    const current = await readTextIfExists(file);

    if (current === content) return false;

    await fs.mkdir(path.dirname(file), { recursive: true });

    const tempFile = tempFileFor(file);

    try {
        await fs.writeFile(tempFile, content, "utf8");
        await fs.rename(tempFile, file);
    } catch (error) {
        await fs.unlink(tempFile).catch(() => undefined);
        throw error;
    }

    return true;
}

function createManifest(registry: ShareLinkRegistry, registryHash: string): ShareLinkManifest {
    const index = createShareLinkIndex(registry);
    const byCanonicalPath: Record<string, ShareId> = {};

    for (const [pageId, id] of [...index.byPageId.entries()].sort(
        ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
    )) {
        const canonicalPath = resolveCanonicalHref(id, index);

        if (canonicalPath === undefined) {
            throw new Error(`active 分享 ID 无法解析 canonical 路由：${id} -> ${pageId}`);
        }

        const existingId = byCanonicalPath[canonicalPath];

        if (existingId !== undefined && existingId !== id) {
            throw new Error(
                `canonical 路由存在多个分享 ID：${canonicalPath}\n- ${existingId}\n- ${id}`,
            );
        }

        byCanonicalPath[canonicalPath] = id;
    }

    return {
        version: 1,
        registryHash,
        shortOrigin: SHARE_LINK_SHORT_ORIGIN,
        byCanonicalPath,
    };
}

export async function prepareShareLinkFiles(
    input: PrepareShareLinkFilesInput,
): Promise<PrepareShareLinkFilesResult> {
    const releaseLock = await acquireRegistryLock(input.generatedRegistryFile);

    try {
        const prepared = generateShareLinks({ pageIds: input.pageIds });
        const registryContent = serializeJson(prepared.registry);

        const generatedRegistryChanged = await writeTextAtomicallyIfChanged(
            input.generatedRegistryFile,
            registryContent,
        );
        const manifest = createManifest(
            prepared.registry,
            hashContent(registryContent),
        );
        const manifestChanged = await writeTextAtomicallyIfChanged(
            input.generatedManifestFile,
            serializeJson(manifest),
        );

        return {
            ...prepared,
            generatedRegistryChanged,
            manifestChanged,
            manifest,
        };
    } finally {
        await releaseLock();
    }
}

export async function checkShareLinkFiles(
    input: CheckShareLinkFilesInput,
): Promise<CheckShareLinkFilesResult> {
    const { generatedCount } = generateShareLinks({ pageIds: input.pageIds });
    return { activeCount: generatedCount, goneCount: 0 };
}

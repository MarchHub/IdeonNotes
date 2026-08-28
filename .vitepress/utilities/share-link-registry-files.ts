import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
    SHARE_LINK_SHORT_ORIGIN,
    type ShareLinkManifest,
} from "../shared/share-link-contract.ts";
import {
    createShareLinkIndex,
    isShareId,
    prepareShareLinks,
    resolveCanonicalHref,
    validateShareLinkRegistry,
    type PrepareShareLinksResult,
    type ShareId,
    type ShareLinkRegistry,
} from "./share-links.ts";

export {
    SHARE_LINK_SHORT_ORIGIN,
    type ShareLinkManifest,
} from "../shared/share-link-contract.ts";

export interface ShareLinkFilePaths {
    registryFile: string;
    generatedManifestFile: string;
}

export interface PrepareShareLinkFilesInput extends ShareLinkFilePaths {
    pageIds: Iterable<string>;
    readTextIfExists?: (file: string) => Promise<string | undefined>;
}

export interface PrepareShareLinkFilesResult extends PrepareShareLinksResult {
    registryChanged: boolean;
    manifestChanged: boolean;
    manifest: ShareLinkManifest;
}

export interface CheckShareLinkFilesInput {
    registryFile: string;
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
    return loadShareLinkRegistryFromReader(registryFile, readTextIfExists);
}

async function loadShareLinkRegistryFromReader(
    registryFile: string,
    readText: (file: string) => Promise<string | undefined>,
): Promise<ShareLinkRegistry> {
    const content = await readText(registryFile);

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
    const releaseLock = await acquireRegistryLock(input.registryFile);

    try {
        const readText = input.readTextIfExists ?? readTextIfExists;
        const initialRegistryContent = await readText(input.registryFile);
        const initialRegistryHash = hashContent(initialRegistryContent ?? "");
        const existingRegistry = await loadShareLinkRegistryFromReader(
            input.registryFile,
            readText,
        );
        const prepared = prepareShareLinks({
            registry: existingRegistry,
            pageIds: input.pageIds,
        });
        const registryContent = serializeJson(prepared.registry);

        const beforeWriteRegistryContent = await readText(input.registryFile);

        if (hashContent(beforeWriteRegistryContent ?? "") !== initialRegistryHash) {
            throw new Error(
                `分享注册表在 prepare 期间已被修改，拒绝覆盖：${input.registryFile}`,
            );
        }

        const registryChanged = await writeTextAtomicallyIfChanged(
            input.registryFile,
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
            registryChanged,
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
    const registry = await loadShareLinkRegistry(input.registryFile);
    validateShareLinkRegistry(registry, input.pageIds);

    let activeCount = 0;
    let goneCount = 0;

    for (const [id, record] of Object.entries(registry.records)) {
        if (!isShareId(id)) {
            throw new Error(`非法分享 ID：${id}`);
        }

        if (record.status === "active") activeCount += 1;
        if (record.status === "gone") goneCount += 1;
    }

    return { activeCount, goneCount };
}

import { baseUrl } from "./site-config.ts";

export const SHARE_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SHARE_ID_LENGTH = 10;
export const SHARE_LINK_SHORT_ORIGIN = baseUrl;
export const SHARE_LINK_MANIFEST_PATH = "/share-links/manifest.json";
export const YUUFRAG_CONTENT_ORIGIN = baseUrl;

const SHARE_ID_PATTERN = new RegExp(
    `^[${SHARE_ID_ALPHABET}]{${SHARE_ID_LENGTH}}$`,
);
const REGISTRY_HASH_PATTERN = /^[0-9a-f]{64}$/;

export type ShareId = string;

export interface ShareLinkManifest {
    version: 1;
    registryHash: string;
    shortOrigin: typeof SHARE_LINK_SHORT_ORIGIN;
    byCanonicalPath: Record<string, ShareId>;
}

export function isShareId(value: string): value is ShareId {
    return SHARE_ID_PATTERN.test(value);
}

export function normalizeCanonicalPath(rawPath: string): string {
    if (typeof rawPath !== "string" || rawPath.length === 0) {
        throw new Error("canonical path 必须是非空字符串");
    }

    const withoutQueryOrHash = rawPath.split(/[?#]/, 1)[0];
    let decoded = withoutQueryOrHash;

    try {
        decoded = decodeURI(withoutQueryOrHash);
    } catch {
        throw new Error(`canonical path 编码非法：${rawPath}`);
    }

    const withLeadingSlash = decoded.startsWith("/") ? decoded : `/${decoded}`;
    const withoutHtml = withLeadingSlash
        .replace(/\/index\.html$/, "/")
        .replace(/\.html$/, "");

    return withoutHtml.normalize("NFC");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseShareLinkManifest(value: unknown): ShareLinkManifest {
    if (!isRecord(value) || value.version !== 1) {
        throw new Error("分享 manifest 版本非法");
    }

    if (
        value.shortOrigin !== SHARE_LINK_SHORT_ORIGIN ||
        typeof value.registryHash !== "string" ||
        !REGISTRY_HASH_PATTERN.test(value.registryHash) ||
        !isRecord(value.byCanonicalPath)
    ) {
        throw new Error("分享 manifest 顶层字段非法");
    }

    const byCanonicalPath: Record<string, ShareId> = {};
    const canonicalPathById = new Map<ShareId, string>();

    for (const [rawPath, rawId] of Object.entries(value.byCanonicalPath)) {
        const canonicalPath = normalizeCanonicalPath(rawPath);

        if (canonicalPath !== rawPath || !isShareId(String(rawId))) {
            throw new Error(`分享 manifest 映射非法：${rawPath}`);
        }

        const existingPath = canonicalPathById.get(rawId as ShareId);
        if (existingPath !== undefined) {
            throw new Error(`分享 manifest ID 重复：${rawId} -> ${existingPath}, ${rawPath}`);
        }

        byCanonicalPath[canonicalPath] = rawId as ShareId;
        canonicalPathById.set(rawId as ShareId, canonicalPath);
    }

    return {
        version: 1,
        registryHash: value.registryHash,
        shortOrigin: SHARE_LINK_SHORT_ORIGIN,
        byCanonicalPath,
    };
}

export function shareIdToShortUrl(id: ShareId): string {
    if (!isShareId(id)) throw new Error(`非法分享 ID：${id}`);
    return `${SHARE_LINK_SHORT_ORIGIN}/s/${id}`;
}

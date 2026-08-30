import { createHash } from "node:crypto";
import { normalizePageId, pageIdToPublicHref } from "./route-paths.ts";
import {
    SHARE_ID_ALPHABET,
    SHARE_ID_LENGTH,
    isShareId,
    type ShareId,
} from "../shared/share-link-contract.ts";

export {
    SHARE_ID_ALPHABET,
    SHARE_ID_LENGTH,
    isShareId,
    type ShareId,
} from "../shared/share-link-contract.ts";

const SHARE_ID_SPACE = BigInt(SHARE_ID_ALPHABET.length) ** BigInt(SHARE_ID_LENGTH);
export type ShareLinkStatus = "active" | "gone";

export interface ShareLinkRecord {
    pageId: string;
    status: ShareLinkStatus;
}

export interface ShareLinkRegistry {
    version: 1;
    records: Record<ShareId, ShareLinkRecord>;
}

export interface ShareLinkIndex {
    byId: ReadonlyMap<ShareId, ShareLinkRecord>;
    byPageId: ReadonlyMap<string, ShareId>;
}

export interface GenerateShareLinksResult {
    registry: ShareLinkRegistry;
    generatedCount: number;
}

export function normalizeSharePageId(pageId: string): string {
    if (typeof pageId !== "string") {
        throw new Error("页面 ID 必须是字符串");
    }

    const normalized = normalizePageId(pageId).normalize("NFC");

    if (normalized.length === 0) {
        throw new Error("页面 ID 不能为空");
    }

    return normalized;
}

function compareStrings(left: string, right: string): number {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function encodeFixedBase31(value: bigint): ShareId {
    const radix = BigInt(SHARE_ID_ALPHABET.length);
    const output = new Array<string>(SHARE_ID_LENGTH);
    let remainder = value;

    for (let index = SHARE_ID_LENGTH - 1; index >= 0; index -= 1) {
        output[index] = SHARE_ID_ALPHABET[Number(remainder % radix)];
        remainder /= radix;
    }

    if (remainder !== 0n) {
        throw new Error("短 ID 超出固定编码空间");
    }

    return output.join("");
}

export function generateStaticShareId(pageIdInput: string): ShareId {
    const pageId = normalizeSharePageId(pageIdInput);

    const digest = createHash("sha256")
        // Keep the former attempt=0 payload so existing paths retain their IDs.
        .update(`yuufrag-share-v1\0${pageId}\0${0}`, "utf8")
        .digest("hex");
    const value = BigInt(`0x${digest}`) % SHARE_ID_SPACE;

    return encodeFixedBase31(value);
}

function assertRegistryShape(registry: ShareLinkRegistry): void {
    if (registry === null || typeof registry !== "object") {
        throw new Error("分享注册表必须是对象");
    }

    if (registry.version !== 1) {
        throw new Error(`不支持的分享注册表版本：${String(registry.version)}`);
    }

    if (registry.records === null || typeof registry.records !== "object") {
        throw new Error("分享注册表 records 必须是对象");
    }
}

function normalizeCurrentPageIds(pageIds: Iterable<string>): string[] {
    const originalByNormalized = new Map<string, string>();

    for (const rawPageId of pageIds) {
        const normalizedPageId = normalizeSharePageId(rawPageId);
        const existing = originalByNormalized.get(normalizedPageId);

        if (existing !== undefined && existing !== rawPageId) {
            throw new Error(
                `规范化后页面 ID 冲突：${normalizedPageId}\n- ${existing}\n- ${rawPageId}`,
            );
        }

        originalByNormalized.set(normalizedPageId, rawPageId);
    }

    return [...originalByNormalized.keys()].sort(compareStrings);
}

function validateRecord(id: string, record: ShareLinkRecord): ShareLinkRecord {
    if (!isShareId(id)) {
        throw new Error(`非法分享 ID：${id}`);
    }

    if (record === null || typeof record !== "object") {
        throw new Error(`分享 ID ${id} 的记录必须是对象`);
    }

    if (record.status !== "active" && record.status !== "gone") {
        throw new Error(`分享 ID ${id} 的状态非法：${String(record.status)}`);
    }

    if (typeof record.pageId !== "string") {
        throw new Error(`分享 ID ${id} 的 pageId 必须是字符串`);
    }

    const normalizedPageId = normalizeSharePageId(record.pageId);

    if (record.pageId !== normalizedPageId) {
        throw new Error(
            `分享 ID ${id} 的 pageId 必须预先归一化：${record.pageId}`,
        );
    }

    return { pageId: normalizedPageId, status: record.status };
}

export function createShareLinkIndex(registry: ShareLinkRegistry): ShareLinkIndex {
    assertRegistryShape(registry);

    const byId = new Map<ShareId, ShareLinkRecord>();
    const byPageId = new Map<string, ShareId>();

    for (const [id, rawRecord] of Object.entries(registry.records).sort(
        ([left], [right]) => compareStrings(left, right),
    )) {
        const record = validateRecord(id, rawRecord);
        const shareId = id as ShareId;

        byId.set(shareId, record);

        if (record.status !== "active") continue;

        const existingId = byPageId.get(record.pageId);

        if (existingId !== undefined) {
            throw new Error(
                `页面存在多个 active 分享 ID：${record.pageId}\n- ${existingId}\n- ${shareId}`,
            );
        }

        byPageId.set(record.pageId, shareId);
    }

    return { byId, byPageId };
}

export function validateShareLinkRegistry(
    registry: ShareLinkRegistry,
    pageIds: Iterable<string>,
): void {
    const currentPageIds = normalizeCurrentPageIds(pageIds);
    const currentPageIdSet = new Set(currentPageIds);
    const index = createShareLinkIndex(registry);

    for (const [pageId, shareId] of index.byPageId) {
        if (!currentPageIdSet.has(pageId)) {
            throw new Error(
                `active 分享 ID 指向不存在页面：${shareId} -> ${pageId}`,
            );
        }
    }

    const missingPageIds = currentPageIds.filter(
        (pageId) => !index.byPageId.has(pageId),
    );

    if (missingPageIds.length > 0) {
        throw new Error(
            [
                "以下页面缺少 active 分享 ID：",
                ...missingPageIds.map((pageId) => `- ${pageId}`),
            ].join("\n"),
        );
    }
}

function createRegistryCopy(registry: ShareLinkRegistry): ShareLinkRegistry {
    const records = Object.fromEntries(
        Object.entries(registry.records)
            .sort(([left], [right]) => compareStrings(left, right))
            .map(([id, record]) => [id, { ...record }]),
    ) as Record<ShareId, ShareLinkRecord>;

    return { version: 1, records };
}

export function generateShareLinks(input: {
    pageIds: Iterable<string>;
}): GenerateShareLinksResult {
    const currentPageIds = normalizeCurrentPageIds(input.pageIds);
    const registry: ShareLinkRegistry = { version: 1, records: {} };

    for (const pageId of currentPageIds) {
        const shareId = generateStaticShareId(pageId);
        const existingRecord = registry.records[shareId];

        if (existingRecord !== undefined) {
            throw new Error(
                `确定性短 ID 碰撞：${shareId}\n- ${existingRecord.pageId}\n- ${pageId}`,
            );
        }

        registry.records[shareId] = { pageId, status: "active" };
    }

    const sortedRegistry = createRegistryCopy(registry);
    validateShareLinkRegistry(sortedRegistry, currentPageIds);

    return {
        registry: sortedRegistry,
        generatedCount: currentPageIds.length,
    };
}

export function resolveCanonicalHref(
    id: ShareId,
    index: ShareLinkIndex,
    cleanUrls = true,
): string | undefined {
    if (!isShareId(id)) return undefined;

    const record = index.byId.get(id);

    if (record === undefined || record.status !== "active") return undefined;

    return pageIdToPublicHref(record.pageId, cleanUrls);
}

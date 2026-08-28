import { promises as fs } from "node:fs";
import path from "node:path";
import {
    YUUFRAG_CONTENT_ORIGIN,
    isShareId,
    type ShareId,
} from "../shared/share-link-contract.ts";
import {
    createShareLinkIndex,
    resolveCanonicalHref,
    type ShareLinkRegistry,
} from "./share-links.ts";
import { pageIdToOutputFile, rewritePageId } from "./route-paths.ts";

export { YUUFRAG_CONTENT_ORIGIN } from "../shared/share-link-contract.ts";

export interface ShortLinkPageMetadata {
    title: string;
    description: string;
}

export interface ShortLinkDeploymentManifest {
    version: 1;
    registryHash: string;
    contentOrigin: typeof YUUFRAG_CONTENT_ORIGIN;
    records: Record<
        ShareId,
        { status: "active"; target: string } | { status: "gone" }
    >;
}

export function parseShortLinkDeploymentManifest(
    value: unknown,
): ShortLinkDeploymentManifest {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("短链部署 manifest 必须是对象");
    }

    const candidate = value as Partial<ShortLinkDeploymentManifest>;
    if (
        candidate.version !== 1 ||
        candidate.contentOrigin !== YUUFRAG_CONTENT_ORIGIN ||
        typeof candidate.registryHash !== "string" ||
        !/^[0-9a-f]{64}$/.test(candidate.registryHash) ||
        candidate.records === null ||
        typeof candidate.records !== "object" ||
        Array.isArray(candidate.records)
    ) {
        throw new Error("短链部署 manifest 顶层字段非法");
    }

    const records: ShortLinkDeploymentManifest["records"] = {};
    for (const [id, rawRecord] of Object.entries(candidate.records)) {
        if (!isShareId(id) || rawRecord === null || typeof rawRecord !== "object") {
            throw new Error(`短链部署记录非法：${id}`);
        }
        const record = rawRecord as { status?: unknown; target?: unknown };
        if (record.status === "gone" && record.target === undefined) {
            records[id] = { status: "gone" };
            continue;
        }
        if (record.status !== "active" || typeof record.target !== "string") {
            throw new Error(`短链部署记录非法：${id}`);
        }
        const target = new URL(record.target);
        if (
            target.origin !== YUUFRAG_CONTENT_ORIGIN ||
            target.username ||
            target.password ||
            target.search ||
            target.hash
        ) {
            throw new Error(`短链部署目标非法：${id}`);
        }
        records[id] = { status: "active", target: target.href };
    }

    return {
        version: 1,
        registryHash: candidate.registryHash,
        contentOrigin: YUUFRAG_CONTENT_ORIGIN,
        records,
    };
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function serializeScriptString(value: string): string {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function pageShell(input: {
    title: string;
    description: string;
    head: string;
    body: string;
}): string {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>${escapeHtml(input.title)}</title>
  <meta name="description" content="${escapeHtml(input.description)}">
  ${input.head}
</head>
<body>
  <main>${input.body}</main>
</body>
</html>
`;
}

export function renderActiveShortLinkPage(input: {
    target: string;
    metadata: ShortLinkPageMetadata;
}): string {
    const target = new URL(input.target);

    if (
        target.origin !== YUUFRAG_CONTENT_ORIGIN ||
        target.username ||
        target.password ||
        target.search ||
        target.hash
    ) {
        throw new Error(`短链目标非法：${input.target}`);
    }

    const href = target.href;
    const escapedHref = escapeHtml(href);
    const title = input.metadata.title || "YuuFrag 分享链接";
    const description = input.metadata.description || "正在前往 YuuFrag 笔记页面";

    return pageShell({
        title,
        description,
        head: [
            `<link rel="canonical" href="${escapedHref}">`,
            `<meta http-equiv="refresh" content="0;url=${escapedHref}">`,
            `<meta property="og:title" content="${escapeHtml(title)}">`,
            `<meta property="og:description" content="${escapeHtml(description)}">`,
            `<meta property="og:url" content="${escapedHref}">`,
            `<script>location.replace(${serializeScriptString(href)});</script>`,
        ].join("\n  "),
        body: `<p>正在前往 <a rel="nofollow" href="${escapedHref}">${escapeHtml(title)}</a>。</p>`,
    });
}

export function renderGoneShortLinkPage(): string {
    return pageShell({
        title: "链接已下线 · YuuFrag",
        description: "这个 YuuFrag 分享链接已下线。",
        head: '<meta name="robots" content="noindex,nofollow">',
        body: "<h1>链接已下线</h1><p>这个分享链接不再指向任何页面。</p>",
    }).replace('<meta name="robots" content="noindex,follow">\n  ', "");
}

export function renderUnknownShortLinkPage(): string {
    return pageShell({
        title: "未找到分享链接 · YuuFrag",
        description: "无法找到这个 YuuFrag 分享链接。",
        head: '<meta name="robots" content="noindex,nofollow">',
        body: "<h1>404</h1><p>无法找到这个分享链接。</p>",
    }).replace('<meta name="robots" content="noindex,follow">\n  ', "");
}

async function pathExists(file: string): Promise<boolean> {
    try {
        await fs.access(file);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
    }
}

export async function publishShortLinkSite(input: {
    registry: ShareLinkRegistry;
    registryHash: string;
    outputDir: string;
    contentDistDir: string;
    metadataForPageId: (pageId: string) => Promise<ShortLinkPageMetadata>;
}): Promise<{ activeCount: number; goneCount: number; manifest: ShortLinkDeploymentManifest }> {
    if (!/^[0-9a-f]{64}$/.test(input.registryHash)) {
        throw new Error("registry hash 非法");
    }

    const index = createShareLinkIndex(input.registry);
    const records: ShortLinkDeploymentManifest["records"] = {};
    const tempDir = `${input.outputDir}.tmp-${process.pid}-${Date.now()}`;
    const backupDir = `${input.outputDir}.backup-${process.pid}-${Date.now()}`;
    let activeCount = 0;
    let goneCount = 0;

    await fs.mkdir(path.join(tempDir, "s"), { recursive: true });

    try {
        for (const [id, record] of [...index.byId.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            if (!isShareId(id)) throw new Error(`非法分享 ID：${id}`);
            const pageDir = path.join(tempDir, "s", id);
            await fs.mkdir(pageDir, { recursive: true });

            if (record.status === "gone") {
                await fs.writeFile(path.join(pageDir, "index.html"), renderGoneShortLinkPage(), "utf8");
                records[id] = { status: "gone" };
                goneCount += 1;
                continue;
            }

            const canonicalPath = resolveCanonicalHref(id, index);
            if (canonicalPath === undefined) throw new Error(`无法解析 active 分享 ID：${id}`);
            const contentFile = path.join(
                input.contentDistDir,
                pageIdToOutputFile(rewritePageId(record.pageId)),
            );

            if (!(await pathExists(contentFile))) {
                throw new Error(`短链目标内容产物不存在：${id} -> ${contentFile}`);
            }

            const target = new URL(canonicalPath, `${YUUFRAG_CONTENT_ORIGIN}/`).href;
            const metadata = await input.metadataForPageId(record.pageId);
            await fs.writeFile(
                path.join(pageDir, "index.html"),
                renderActiveShortLinkPage({ target, metadata }),
                "utf8",
            );
            records[id] = { status: "active", target };
            activeCount += 1;
        }

        const manifest: ShortLinkDeploymentManifest = {
            version: 1,
            registryHash: input.registryHash,
            contentOrigin: YUUFRAG_CONTENT_ORIGIN,
            records,
        };
        await fs.writeFile(
            path.join(tempDir, "manifest.json"),
            `${JSON.stringify(manifest, null, 2)}\n`,
            "utf8",
        );
        await fs.writeFile(path.join(tempDir, "404.html"), renderUnknownShortLinkPage(), "utf8");

        const hadOutput = await pathExists(input.outputDir);
        if (hadOutput) await fs.rename(input.outputDir, backupDir);

        try {
            await fs.rename(tempDir, input.outputDir);
        } catch (error) {
            if (hadOutput) await fs.rename(backupDir, input.outputDir);
            throw error;
        }

        if (hadOutput) await fs.rm(backupDir, { recursive: true, force: true });
        return { activeCount, goneCount, manifest };
    } catch (error) {
        await fs.rm(tempDir, { recursive: true, force: true });
        throw error;
    }
}

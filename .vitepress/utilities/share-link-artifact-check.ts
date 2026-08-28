import { promises as fs } from "node:fs";
import path from "node:path";
import {
    SHARE_LINK_SHORT_ORIGIN,
    parseShareLinkManifest,
} from "../shared/share-link-contract.ts";
import {
    parseShortLinkDeploymentManifest,
    type ShortLinkDeploymentManifest,
} from "./short-link-pages.ts";

async function readJson(file: string): Promise<unknown> {
    return JSON.parse(await fs.readFile(file, "utf8")) as unknown;
}

export async function checkShareLinkArtifacts(input: {
    browserManifestFile: string;
    shortManifestFile: string;
    shortDistDir: string;
}): Promise<{ registryHash: string; activeCount: number; goneCount: number }> {
    const browser = parseShareLinkManifest(await readJson(input.browserManifestFile));
    const short = parseShortLinkDeploymentManifest(await readJson(input.shortManifestFile));

    if (browser.registryHash !== short.registryHash) {
        throw new Error(
            `双产物 registry hash 不一致：${browser.registryHash} != ${short.registryHash}`,
        );
    }

    const browserPathById = new Map<string, string>();
    for (const [canonicalPath, id] of Object.entries(browser.byCanonicalPath)) {
        const existingPath = browserPathById.get(id);
        if (existingPath !== undefined) {
            throw new Error(`浏览器 manifest 中 ID 重复：${id} -> ${existingPath}, ${canonicalPath}`);
        }
        browserPathById.set(id, canonicalPath);
    }

    let activeCount = 0;
    let goneCount = 0;
    for (const [id, record] of Object.entries(short.records)) {
        await fs.access(path.join(input.shortDistDir, "s", id, "index.html"));
        if (record.status === "gone") {
            if (browserPathById.has(id)) throw new Error(`gone ID 出现在浏览器 manifest：${id}`);
            goneCount += 1;
            continue;
        }

        const canonicalPath = browserPathById.get(id);
        if (canonicalPath === undefined) throw new Error(`active ID 缺少浏览器映射：${id}`);
        if (new URL(record.target).pathname !== new URL(canonicalPath, short.contentOrigin).pathname) {
            throw new Error(`active ID 双产物目标不一致：${id}`);
        }
        activeCount += 1;
    }

    if (activeCount !== browserPathById.size) {
        throw new Error("浏览器 manifest 存在未发布的 active ID");
    }

    await fs.access(path.join(input.shortDistDir, "404.html"));
    return { registryHash: browser.registryHash, activeCount, goneCount };
}

export function assertNoPublishedShortLinks(
    files: ReadonlyArray<{ file: string; content: string }>,
): void {
    const shortLinkPrefix = `${SHARE_LINK_SHORT_ORIGIN}/s/`;
    const offenders = files
        .filter(({ content }) => content.includes(shortLinkPrefix))
        .map(({ file }) => file);

    if (offenders.length > 0) {
        throw new Error(`内容索引不得发布短链：\n${offenders.map((file) => `- ${file}`).join("\n")}`);
    }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseShareLinkManifest } from "../shared/share-link-contract.ts";
import { loadShareLinkRegistry } from "../utilities/share-link-registry-files.ts";
import {
    publishShortLinkSite,
    type ShortLinkPageMetadata,
} from "../utilities/short-link-pages.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const registryFile = path.join(projectRoot, ".vitepress/generated/share-links.json");
const manifestFile = path.join(projectRoot, ".vitepress/generated/share-links-manifest.json");
const contentDistDir = path.join(projectRoot, ".vitepress/dist");
const outputDir = path.join(projectRoot, ".shortlink-dist");
const registry = await loadShareLinkRegistry(registryFile);
const manifest = parseShareLinkManifest(
    JSON.parse(await fs.readFile(manifestFile, "utf8")) as unknown,
);

async function metadataForPageId(pageId: string): Promise<ShortLinkPageMetadata> {
    const source = await fs.readFile(path.join(projectRoot, pageId), "utf8");
    const parsed = matter(source);
    const heading = parsed.content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const fallbackTitle = path.basename(pageId, path.extname(pageId));

    return {
        title: typeof parsed.data.title === "string"
            ? parsed.data.title
            : heading ?? fallbackTitle,
        description: typeof parsed.data.description === "string"
            ? parsed.data.description
            : "Machillka 的学习记录与共享笔记库",
    };
}

const result = await publishShortLinkSite({
    registry,
    registryHash: manifest.registryHash,
    outputDir,
    contentDistDir,
    metadataForPageId,
});

const contentShortLinkDir = path.join(contentDistDir, "s");
await fs.rm(contentShortLinkDir, { recursive: true, force: true });
await fs.cp(path.join(outputDir, "s"), contentShortLinkDir, { recursive: true });

console.info(
    `[share-links] published ${result.activeCount} active and ${result.goneCount} gone short-link pages to ${outputDir} and ${contentShortLinkDir}`,
);

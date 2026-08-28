import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import {
    assertNoPublishedShortLinks,
    checkShareLinkArtifacts,
} from "../utilities/share-link-artifact-check.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const contentDistDir = path.join(projectRoot, ".vitepress/dist");
const shortDistDir = path.join(projectRoot, ".shortlink-dist");
const result = await checkShareLinkArtifacts({
    browserManifestFile: path.join(contentDistDir, "share-links/manifest.json"),
    shortManifestFile: path.join(shortDistDir, "manifest.json"),
    shortDistDir,
});
const indexFiles = await fg(
    ["sitemap*.xml", "feed.rss", "**/phaseshard*.json", "**/*search*index*.json"],
    { cwd: contentDistDir, onlyFiles: true },
);
assertNoPublishedShortLinks(await Promise.all(indexFiles.map(async (file) => ({
    file,
    content: await fs.readFile(path.join(contentDistDir, file), "utf8"),
}))));

console.info(
    `[share-links] artifacts match registry ${result.registryHash}; ${result.activeCount} active, ${result.goneCount} gone`,
);

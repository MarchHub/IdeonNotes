import fg from "fast-glob";
import path from "node:path";
import { prepareShareLinkFiles } from "../utilities/share-link-registry-files.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const generatedRegistryFile = path.join(
    projectRoot,
    ".vitepress/generated/share-links.json",
);
const generatedManifestFile = path.join(
    projectRoot,
    ".vitepress/generated/share-links-manifest.json",
);

const pageIds = await fg("posts/**/*.md", {
    cwd: projectRoot,
    onlyFiles: true,
});
const result = await prepareShareLinkFiles({
    generatedRegistryFile,
    generatedManifestFile,
    pageIds,
});

console.info(
    `[share-links] ${result.generatedCount} generated, ${result.generatedRegistryChanged ? "registry updated" : "registry unchanged"}, ${result.manifestChanged ? "manifest updated" : "manifest unchanged"}`,
);

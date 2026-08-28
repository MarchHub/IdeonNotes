import fg from "fast-glob";
import path from "node:path";
import { checkShareLinkFiles } from "../utilities/share-link-registry-files.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const registryFile = path.join(projectRoot, ".vitepress/data/share-links.json");
const pageIds = await fg("posts/**/*.md", {
    cwd: projectRoot,
    onlyFiles: true,
});
const result = await checkShareLinkFiles({ registryFile, pageIds });

console.info(
    `[share-links] ${result.activeCount} active, ${result.goneCount} gone; registry check passed`,
);

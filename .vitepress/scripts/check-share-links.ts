import fg from "fast-glob";
import path from "node:path";
import { checkShareLinkFiles } from "../utilities/share-link-registry-files.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const pageIds = await fg("posts/**/*.md", {
    cwd: projectRoot,
    onlyFiles: true,
});
const result = await checkShareLinkFiles({ pageIds });

console.info(
    `[share-links] ${result.activeCount} deterministic IDs; generation check passed`,
);

import path from "node:path";
import { fileURLToPath } from "node:url";

import { tagCatalogFilePath, writeTagCatalog } from "../utilities/tag-catalog.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const catalog = await writeTagCatalog(projectRoot);

console.log(
    `[tags] ${catalog.tags.length} 个标签，${catalog.taggedPostCount}/${catalog.postCount} 篇文章已标注`,
);
console.log(`[tags] ${tagCatalogFilePath(projectRoot)}`);

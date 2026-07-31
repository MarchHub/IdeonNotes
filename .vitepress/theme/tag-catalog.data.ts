import path from "node:path";

import { defineLoader } from "vitepress";

import {
    buildTagCatalog,
    type TagCatalog,
} from "../utilities/tag-catalog.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");

declare const data: TagCatalog;
export { data };

export default defineLoader({
    watch: ["posts/**/*.md"],
    async load() {
        return buildTagCatalog(projectRoot);
    },
});

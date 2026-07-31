import path from "node:path";

import { buildTagCatalog } from "../.vitepress/utilities/tag-catalog.ts";

export default {
    async paths() {
        const projectRoot = path.resolve(import.meta.dirname, "..");
        const catalog = await buildTagCatalog(projectRoot);

        return catalog.tags.map((tag) => ({
            params: { tag: tag.routeId },
        }));
    },
};

import { createContentLoader } from "vitepress";
import {
    pageIdToPublicHref,
    sourceHrefToPageId,
} from "../utilities/route-paths";

export interface CategorySummary {
    name: string;
    title: string;
    description: string;
    url: string;
    count: number;
    order: number;
}

interface MutableCategory extends CategorySummary {
    hasIndex: boolean;
}

declare const data: CategorySummary[];
export { data };

export default createContentLoader("posts/**/*.md", {
    transform(raw): CategorySummary[] {
        const categories = new Map<string, MutableCategory>();

        for (const { url, frontmatter } of raw) {
            const pageId = sourceHrefToPageId(url);
            const parts = pageId.split("/");

            if (parts[0] !== "posts" || parts.length < 3) continue;

            const name = parts[1];
            const category = categories.get(name) ?? {
                name,
                title: name,
                description: "浏览这个分类下的全部文章。",
                url: pageIdToPublicHref(`posts/${name}/index.md`),
                count: 0,
                order: Number.MAX_SAFE_INTEGER,
                hasIndex: false,
            };
            const isCategoryIndex =
                parts.length === 3 && parts[2] === "index.md";

            if (isCategoryIndex) {
                category.title = frontmatter.title || name;
                category.description =
                    frontmatter.description || category.description;
                category.order =
                    Number(frontmatter.categoryOrder) || category.order;
                category.hasIndex = true;
            } else if (frontmatter.publish !== false) {
                category.count += 1;
            }

            categories.set(name, category);
        }

        return [...categories.values()]
            .filter((category) => category.hasIndex)
            .sort(
                (a, b) =>
                    a.order - b.order ||
                    a.title.localeCompare(b.title, "zh-CN"),
            )
            .map(({ hasIndex: _hasIndex, ...category }) => category);
    },
});

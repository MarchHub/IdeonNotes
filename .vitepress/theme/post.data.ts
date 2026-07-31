import { createContentLoader } from "vitepress";
import {
    pageIdToPublicHref,
    sourceHrefToPageId,
} from "../utilities/route-paths";
import { extractHeadingExcerpt } from "./utilities/excerpt";
import { getGitTimestamp } from "./utilities/gitinfo";

export interface Post {
    title: string;
    url: string;
    date: number;
    excerpt: string | undefined;
}

declare const data: Post[];
export { data };

export default createContentLoader("posts/**/*.md", {
    excerpt(file) {
        file.excerpt = extractHeadingExcerpt(file.content);
    },
    includeSrc: true,
    transform(raw): Post[] {
        return raw
            .map(({ url, frontmatter, excerpt, src }) => {
                const sourcePageId = sourceHrefToPageId(url);
                const publicUrl = pageIdToPublicHref(sourcePageId);
                const date = getGitTimestamp(sourcePageId, "updated");

                let title = frontmatter.title;

                if (!title && src) {
                    const h1Match = src.match(/^#\s+(.+)$/m);
                    if (h1Match) {
                        title = h1Match[1].trim();
                    }
                }

                if (!title) {
                    title =
                        sourcePageId
                            .split("/")
                            .pop()
                            ?.replace(/\.md$/, "") || "Untitled";
                }

                return {
                    title,
                    url: publicUrl,
                    date,
                    excerpt,
                };
            })
            .sort((a, b) => b.date - a.date)
            .slice(0, 6);
    },
});

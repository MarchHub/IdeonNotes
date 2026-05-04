import { createContentLoader } from "vitepress";
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
    excerpt: true,
    includeSrc: true,
    transform(raw): Post[] {
        return raw
            .map(({ url, frontmatter, excerpt, src }) => {
                const decodedUrl = decodeURI(url);

                const filePath = url.replace(/^\//, "") + ".md";
                const date = getGitTimestamp(filePath, "updated");

                let title = frontmatter.title;

                if (!title && src) {
                    const h1Match = src.match(/^#\s+(.+)$/m);
                    if (h1Match) {
                        title = h1Match[1].trim();
                    }
                }

                if (!title) {
                    title =
                        decodedUrl
                            .split("/")
                            .pop()
                            ?.replace(/\.html$/, "") || "Untitled";
                }

                return {
                    title,
                    url,
                    date,
                    excerpt,
                };
            })
            .sort((a, b) => b.date - a.date)
            .slice(0, 6);
    },
});

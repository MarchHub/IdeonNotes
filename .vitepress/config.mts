import { defineConfig } from "vitepress";
import { aboutSidebar, postSidebar } from "./scripts/SidebarGenerator";
import { ScanCurrentDir } from "./scripts/NavGenerator";
import contributorsConfig from "./env-config";
import { prepareGithubContributors } from "./plugins/GithubContributors";
import markdownItTaskCheckbox from "markdown-it-task-checkbox";
import mark from "markdown-it-mark";
import footnote from "markdown-it-footnote";
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import wikilink from "markdown-it-wikilinks";
import { BiDirectionalLinks } from "@nolebase/markdown-it-bi-directional-links";

import { RSSOptions, RssPlugin } from "vitepress-plugin-rss";

const baseUrl = "https://blog.machillka.site";
const contributorIndex = await prepareGithubContributors(contributorsConfig);
const RSS: RSSOptions = {
    title: `Machillka's Notes`,
    baseUrl,
    copyright: "Copyright (c) 2025-present, Machillka",

    render: (html) => {
        return html.replace(
            /(src|href)\s*=\s*["']([^"']+)["']/g,
            (match, attr, src) => {
                // 跳过绝对路径和锚点
                if (/^https?:\/\/|^\/\/|^#|^mailto:/.test(src)) {
                    return match;
                }

                // 1. 清理路径：去除 ./
                let processedSrc = src.replace(/^\.\//, "");

                // 2. 关键点：如果你的图片文件夹 Assets 就在根目录或 public 下
                if (!processedSrc.startsWith("/")) {
                    processedSrc = "/" + processedSrc;
                }

                // 3. 解决空格问题：RSS 里的链接不能有空格，必须转义为 %20
                const encodedSrc = processedSrc.replace(/ /g, "%20");

                // 4. 返回完整 URL
                console.log(`RSS Rewriting: ${src} -> ${baseUrl}${encodedSrc}`); // 用于构建时调试查看
                return `${attr}="${baseUrl}${encodedSrc}"`;
            },
        );
    },
};

const base = "/";

export default defineConfig({
    base: base,
    sitemap: {
        hostname: baseUrl + "/",
    },
    title: "YuuFrag",
    description: "Record learning journey",
    head: [["link", { rel: "icon", href: base + "favicon.ico" }]],
    cleanUrls: true,
    markdown: {
        math: true,
        config: (md) => {
            md.use(markdownItTaskCheckbox)
                .use(mark)
                .use(footnote)
                .use(wikilink, {
                    linkPattern: `/[[([\s\S]+?)\]]/`,
                    pageResolver: (name: string) =>
                        name
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            .replace(/[^\w-]/g, ""),
                    hrefTemplate: (path: any) => `/${path}/`,
                    htmlAttributes: { class: "wikilink", target: "_blank" },
                })
                .use(BiDirectionalLinks());
            // md.renderer.rules.heading_close = (tokens, idx, options, env, slf) => {
            //     let htmlResult = slf.renderToken(tokens, idx, options);
            //     if (tokens[idx].tag === 'h1') htmlResult += `<ArticleMetadata />`;
            //     return htmlResult;
            // }
        },
        codeTransformers: [transformerTwoslash()],
        theme: {
            light: "material-theme-lighter",
            dark: "material-theme-palenight",
        },
    },
    lastUpdated: true,
    transformPageData(pageData) {
        const contributors =
            contributorIndex[pageData.filePath.replace(/\\/g, "/")];

        if (contributors === undefined) return;

        return {
            frontmatter: {
                ...pageData.frontmatter,
                contributors,
            },
        };
    },
    themeConfig: {
        search: {
            provider: "local",
        },
        lastUpdated: {
            text: "上次更新于",
            formatOptions: {},
        },
        nav: [
            { text: "主页", link: "/" },
            { text: "指南", link: "/guide/" },
            { text: "关于", link: "/about/" },
            { text: "笔记总览", link: "/map" },
            {
                text: "分类",
                items: ScanCurrentDir("../../posts/", "posts"),
            },
        ],
        sidebar: {
            "/guide/": [
                {
                    text: "指南",
                    items: [
                        { text: "站点说明", link: "/guide/" },
                        { text: "提交笔记", link: "/guide/note.md" },
                        { text: "参与开发", link: "/guide/development.md" },
                    ],
                },
            ],
            "/posts/": postSidebar,
            "/about/": aboutSidebar,
        },
        socialLinks: [{ icon: "github", link: "https://github.com/machillka" }],

        footer: {
            message: "Released under the MIT License.",
            copyright:
                'Copyright © 2025-present <a href="https://github.com/machillka">Machillka</a>',
        },
    },
    vite: {
        plugins: [RssPlugin(RSS)],
    },
});

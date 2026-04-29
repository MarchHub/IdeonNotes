import { defineConfig } from "vitepress";
import { aboutSidebar, postSidebar } from "./scripts/SidebarGenerator";
import { ScanCurrentDir } from "./scripts/NavGenerator";
import githubContributors from "./plugins/FetchContributors";
import markdownItTaskCheckbox from "markdown-it-task-checkbox";
import mark from "markdown-it-mark";
import footnote from "markdown-it-footnote";
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import wikilink from "markdown-it-wikilinks";
import { BiDirectionalLinks } from "@nolebase/markdown-it-bi-directional-links";

import { RSSOptions, RssPlugin } from "vitepress-plugin-rss";

const baseUrl = "https://blog.machillka.site";
const RSS: RSSOptions = {
    title: `Machillka's Notes`,
    baseUrl,
    copyright: "Copyright (c) 2025-present, Machillka",
};

const base = "/";

export default defineConfig({
    base: base,
    sitemap: {
        hostname: baseUrl + "/",
    },
    title: "部落阁",
    description: "Record learning journey",
    head: [
        ["link", { rel: "icon", href: base + "favicon.ico" }],
        // ['meta', { name : 'algolia-site-verification', content: '98C626A87738BF05'}]
    ],
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
        plugins: [githubContributors(), RssPlugin(RSS)],
    },
});

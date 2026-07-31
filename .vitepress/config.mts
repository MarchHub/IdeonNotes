import { defineConfig } from "vitepress";
import { aboutSidebar, postSidebar } from "./scripts/SidebarGenerator";
import { ScanCurrentDir } from "./scripts/NavGenerator";
import contributorsConfig from "./env-config";
import { prepareGithubContributors } from "./plugins/GithubContributors";
import markdownItTaskCheckbox from "markdown-it-task-checkbox";
import mark from "markdown-it-mark";
import footnote from "markdown-it-footnote";
import wikilink from "markdown-it-wikilinks";
import { BiDirectionalLinks } from "@nolebase/markdown-it-bi-directional-links";

import {
    RssPlugin,
    type PostInfo,
    type RSSOptions,
} from "vitepress-plugin-rss";
import { RssAssetPlugin } from "./utilities/rss-assets";
import {
    PageRoutePlugin,
    writeLegacyPageRedirects,
} from "./utilities/page-route-plugin";
import { createPageRouteRewriter } from "./utilities/route-paths";

const baseUrl = "https://yuufrag.machillka.com";
const feedUrl = `${baseUrl}/feed.rss`;
const contributorIndex = await prepareGithubContributors(contributorsConfig);

function hasExplicitValidDate(post: PostInfo): boolean {
    const frontmatter = post.fileContent.match(
        /^---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    )?.[1];

    return (
        frontmatter !== undefined &&
        /^date\s*:/m.test(frontmatter) &&
        !Number.isNaN(Date.parse(String(post.frontmatter.date)))
    );
}

const RSS: RSSOptions = {
    title: `Machillka's Notes`,
    description: "Machillka 的学习记录与共享笔记库",
    baseUrl,
    link: baseUrl,
    url: feedUrl,
    feed: feedUrl,
    language: "zh-CN",
    copyright: "Copyright (c) 2025-present, Machillka",
    filter(post) {
        // An explicit valid date is the publication marker for RSS.
        // Undated knowledge pages stay out until the frontmatter schema is defined.
        return post.url.startsWith("/posts/") && hasExplicitValidDate(post);
    },
};

const base = "/";

export default defineConfig({
    base: base,
    rewrites: createPageRouteRewriter(),
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
    async buildEnd(siteConfig) {
        await writeLegacyPageRedirects(siteConfig);
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
        plugins: [
            PageRoutePlugin(),
            RssPlugin(RSS),
            RssAssetPlugin({ baseUrl, filename: "feed.rss" }),
        ],
    },
});

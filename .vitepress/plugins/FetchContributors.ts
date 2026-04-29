import type { Plugin } from "vite";
import fetch from "node-fetch";
import { relative, sep } from "path";
import matter from "gray-matter";

import contributors_config from "../env-config";
import dotenv from "dotenv";
dotenv.config();

/**
 * VitePress 插件：为每个 .md 文件注入 contributors frontmatter
 */
export default function githubContributors(): Plugin {
    // const { owner, repo, apiBase = 'https://api.github.com' } =
    const { owner, repo } = contributors_config;
    const apiBase = "https://api.github.com";
    return {
        name: "vitepress-github-contributors",
        enforce: "pre",

        async transform(code, id) {
            if (!id.endsWith(".md")) return null;

            const relPath = relative(process.cwd(), id).split(sep).join("/");

            const url = `${apiBase}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(relPath)}&per_page=100`;
            const res = await fetch(url, {
                headers: {
                    Authorization: `token ${process.env.GITHUB_TOKEN || ""}`,
                },
            });
            if (!res.ok) {
                console.warn(
                    `[github-contributors] 拉取失败：${res.status} ${res.statusText}`,
                );
                return null;
            }
            const commits = await res.json();

            const map = new Map<
                string,
                { login: string; avatar: string; url: string }
            >();
            for (const c of commits) {
                const a = c.author; // 如果 author 为 null，则跳过
                if (a?.login && !map.has(a.login)) {
                    map.set(a.login, {
                        login: a.login, // 登录信息
                        avatar: a.avatar_url, // 图标地址
                        url: a.html_url, // 个人主页
                    });
                }
            }
            const contributors = Array.from(map.values());

            const { data: original, content } = matter(code);

            const addedData = {
                contributors: contributors,
            };

            const mergedData = {
                ...original,
                ...addedData,
            };

            // console.log(mergedData)

            const result = matter.stringify(content, mergedData);

            return { code: result, map: null };
        },
    };
}

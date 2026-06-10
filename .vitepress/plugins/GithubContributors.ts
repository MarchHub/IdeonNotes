import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import fg from "fast-glob";

import type { GitHubContribConfig } from "../env-config";

export interface Contributor {
    login: string;
    name: string;
    avatar: string;
    url: string;
}

export type ContributorIndex = Record<string, Contributor[]>;

interface GitHubContributor {
    login: string;
    name: string;
    avatarSource: string;
    url: string;
}

interface AvatarCacheEntry {
    source: string;
    path: string;
}

interface ContributorCache {
    version: 1 | 2;
    repository: string;
    generatedAt: string;
    pages: ContributorIndex;
    avatars: Record<string, AvatarCacheEntry>;
}

const CACHE_VERSION = 2;

export async function prepareGithubContributors(
    config: GitHubContribConfig,
): Promise<ContributorIndex> {
    const root = process.cwd();
    const repository = `${config.owner}/${config.repo}`;
    const cacheFile = path.resolve(
        root,
        config.cacheFile ?? ".vitepress/cache/github-contributors.json",
    );
    const publicDirectory = path.resolve(root, "public");
    const avatarDirectory = path.resolve(
        root,
        config.avatarDirectory ?? "public/contributors",
    );
    const avatarPublicPath = resolvePublicPath(
        publicDirectory,
        avatarDirectory,
    );

    dotenv.config({ path: path.resolve(root, ".env"), quiet: true });

    const previous = await readCache(cacheFile, repository);
    const token = process.env[config.tokenEnvKey ?? "GITHUB_TOKEN"];

    if (!token) {
        console.info(
            `[github-contributors] ${config.tokenEnvKey ?? "GITHUB_TOKEN"} is not set; using ${Object.keys(previous.pages).length} cached pages.`,
        );
        return previous.pages;
    }

    const files = (
        await fg(config.include ?? ["**/*.md"], {
            cwd: root,
            ignore: config.exclude ?? [
                ".git/**",
                ".github/**",
                ".vitepress/**",
                "node_modules/**",
                "public/**",
            ],
            onlyFiles: true,
        })
    ).map(normalizePath);

    const octokit = new Octokit({
        auth: token,
        baseUrl: config.apiBase ?? "https://api.github.com",
        userAgent: "YuuFrag-contributor-cache",
    });

    try {
        await octokit.rest.repos.get({
            owner: config.owner,
            repo: config.repo,
        });
    } catch (error) {
        console.warn(
            `[github-contributors] Cannot access ${repository}; using cached data. ${formatError(error)}`,
        );
        return previous.pages;
    }

    const rawPages: Record<string, GitHubContributor[]> = {};
    const pages: ContributorIndex = {};
    const concurrency = Math.max(1, config.concurrency ?? 6);

    await runWithConcurrency(files, concurrency, async (file) => {
        try {
            rawPages[file] = await fetchPageContributors(octokit, config, file);
        } catch (error) {
            pages[file] = previous.pages[file] ?? [];
            console.warn(
                `[github-contributors] Failed to refresh ${file}; using cached data. ${formatError(error)}`,
            );
        }
    });

    await mkdir(avatarDirectory, { recursive: true });

    const avatars = { ...previous.avatars };
    const contributorSources = new Map<string, string>();

    for (const contributors of Object.values(rawPages)) {
        for (const contributor of contributors) {
            contributorSources.set(contributor.login, contributor.avatarSource);
        }
    }

    await runWithConcurrency(
        [...contributorSources.entries()],
        concurrency,
        async ([login, source]) => {
            avatars[login] = await cacheAvatar(
                login,
                source,
                avatarDirectory,
                avatarPublicPath,
                previous.avatars[login],
            );
        },
    );

    for (const [file, contributors] of Object.entries(rawPages)) {
        pages[file] = contributors.map(({ avatarSource, ...contributor }) => ({
            ...contributor,
            avatar: avatars[contributor.login].path,
        }));
    }

    const cache: ContributorCache = {
        version: CACHE_VERSION,
        repository,
        generatedAt: new Date().toISOString(),
        pages,
        avatars,
    };

    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

    console.info(
        `[github-contributors] Cached ${files.length} pages and ${contributorSources.size} contributor avatars.`,
    );

    return pages;
}

async function fetchPageContributors(
    octokit: Octokit,
    config: GitHubContribConfig,
    file: string,
): Promise<GitHubContributor[]> {
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner: config.owner,
        repo: config.repo,
        path: file,
        per_page: 100,
    });
    const contributors = new Map<string, GitHubContributor>();

    for (const commit of commits) {
        const author = commit.author;
        if (!author?.login || !author.avatar_url || !author.html_url) continue;

        if (contributors.has(author.login)) continue;

        contributors.set(author.login, {
            login: author.login,
            name: author.login,
            avatarSource: author.avatar_url,
            url: author.html_url,
        });
    }

    return [...contributors.values()].sort((a, b) =>
        a.login.localeCompare(b.login),
    );
}

async function cacheAvatar(
    login: string,
    source: string,
    avatarDirectory: string,
    avatarPublicPath: string,
    previous?: AvatarCacheEntry,
): Promise<AvatarCacheEntry> {
    try {
        const response = await fetch(source, {
            headers: {
                Accept: "image/avif,image/webp,image/png,image/jpeg",
                "User-Agent": "YuuFrag-contributor-cache",
            },
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        const extension = extensionForContentType(
            response.headers.get("content-type"),
        );
        const fileName = `${safeFileName(login)}.${extension}`;
        await writeFile(
            path.join(avatarDirectory, fileName),
            Buffer.from(await response.arrayBuffer()),
        );

        return {
            source,
            path: `${avatarPublicPath}/${fileName}`,
        };
    } catch (error) {
        if (previous && (await publicAssetExists(previous.path))) {
            console.warn(
                `[github-contributors] Failed to refresh avatar for ${login}; using cached avatar. ${formatError(error)}`,
            );
            return previous;
        }

        const fileName = `${safeFileName(login)}.svg`;
        await writeFile(
            path.join(avatarDirectory, fileName),
            createFallbackAvatar(login),
            "utf8",
        );
        console.warn(
            `[github-contributors] Failed to download avatar for ${login}; generated a local fallback. ${formatError(error)}`,
        );

        return {
            source,
            path: `${avatarPublicPath}/${fileName}`,
        };
    }
}

async function readCache(
    cacheFile: string,
    repository: string,
): Promise<ContributorCache> {
    try {
        const cache = JSON.parse(
            await readFile(cacheFile, "utf8"),
        ) as ContributorCache;

        if (cache.repository.toLowerCase() === repository.toLowerCase()) {
            return {
                ...cache,
                version: CACHE_VERSION,
                pages: Object.fromEntries(
                    Object.entries(cache.pages).map(([file, contributors]) => [
                        file,
                        contributors.map(({ login, name, avatar, url }) => ({
                            login,
                            name,
                            avatar,
                            url,
                        })),
                    ]),
                ),
            };
        }
    } catch {
        // A missing or invalid cache is equivalent to an empty cache.
    }

    return {
        version: CACHE_VERSION,
        repository,
        generatedAt: "",
        pages: {},
        avatars: {},
    };
}

async function publicAssetExists(publicPath: string): Promise<boolean> {
    const publicDirectory = path.resolve(process.cwd(), "public");
    const asset = path.resolve(publicDirectory, publicPath.replace(/^\/+/, ""));

    if (!asset.startsWith(`${publicDirectory}${path.sep}`)) return false;

    try {
        await access(asset);
        return true;
    } catch {
        return false;
    }
}

async function runWithConcurrency<T>(
    values: T[],
    concurrency: number,
    task: (value: T) => Promise<void>,
): Promise<void> {
    let cursor = 0;

    async function worker() {
        while (cursor < values.length) {
            const value = values[cursor++];
            await task(value);
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, values.length) }, worker),
    );
}

function normalizePath(file: string): string {
    return file.split(path.sep).join("/");
}

function resolvePublicPath(
    publicDirectory: string,
    assetDirectory: string,
): string {
    const relative = path.relative(publicDirectory, assetDirectory);

    if (
        !relative ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new Error(
            "[github-contributors] avatarDirectory must be a subdirectory of public.",
        );
    }

    return `/${normalizePath(relative).replace(/\/+$/, "")}`;
}

function safeFileName(login: string): string {
    return login.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function extensionForContentType(contentType: string | null): string {
    if (contentType?.includes("image/avif")) return "avif";
    if (contentType?.includes("image/webp")) return "webp";
    if (contentType?.includes("image/jpeg")) return "jpg";
    if (contentType?.includes("image/svg")) return "svg";
    return "png";
}

function createFallbackAvatar(login: string): string {
    const initial = escapeXml(login.slice(0, 2).toUpperCase());
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#6b7280"/><text x="32" y="38" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#fff">${initial}</text></svg>`;
}

function escapeXml(value: string): string {
    return value.replace(
        /[<>&'"]/g,
        (character) =>
            ({
                "<": "&lt;",
                ">": "&gt;",
                "&": "&amp;",
                "'": "&apos;",
                '"': "&quot;",
            })[character]!,
    );
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

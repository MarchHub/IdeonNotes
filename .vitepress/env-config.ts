// 部署使用到的变量

export interface GitHubContribConfig {
    owner: string;
    repo: string;
    tokenEnvKey?: string;
    apiBase?: string;
    include?: string[];
    exclude?: string[];
    cacheFile?: string;
    avatarDirectory?: string;
    concurrency?: number;
}

const contributors_config: GitHubContribConfig = {
    owner: "MarchHub",
    repo: "YuuFrag",
    tokenEnvKey: "GITHUB_TOKEN",
    include: ["**/*.md"],
    exclude: [
        ".git/**",
        ".github/**",
        ".vitepress/**",
        "node_modules/**",
        "public/**",
    ],
};

export default contributors_config;

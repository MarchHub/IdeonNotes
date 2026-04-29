// 部署使用到的变量

export interface GitHubContribConfig {
    owner: string;
    repo: string;
    tokenEnvKey?: string;
}

const contributors_config: GitHubContribConfig = {
    owner: "machillka",
    repo: "vitepress-blog",
};

export default contributors_config;

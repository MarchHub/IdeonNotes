# 参与开发

项目地址: [YuuFrag](https://github.com/MarchHub/YuuFrag)

```bash
git clone https://github.com/MarchHub/YuuFrag.git
cd shared-blog
pnpm install
pnpm run docs:build
pnpm run docs:preview
```

即可在浏览器中查看构建好的站点（一切以应用台输出为主

## 贡献者缓存

构建时会从环境变量 `GITHUB_TOKEN` 读取 GitHub token，并拉取每篇 Markdown
文件的提交贡献者。贡献者数据缓存到 `.vitepress/cache/github-contributors.json`，
头像缓存到 `public/contributors`，两者均为构建生成内容。

```bash
cp .env.example .env
pnpm docs:build
```

发布产物中的贡献者头像来自本地 `/contributors` 路径，页面渲染不依赖 GitHub
头像服务。未设置 token 或 GitHub 请求失败时，构建会回退到已有缓存。

真实 token 只能写入被 Git 忽略的 `.env`，不要写入 `.env.example` 或使用
`VITE_` 前缀。`pnpm docs:build` 会先执行 `pnpm check:secrets`，检查所有可能
被提交的文件中是否包含常见 GitHub token 或私钥。

## 项目结构

```text
.
├── posts                   # 用于展示的笔记
├── guide                   # 站点参与指南
├── .vitepress              # 配置文件
│   └── plugins             # 自定义插件
│   └── scripts             # 自定义脚本
│   └── theme
│       └── components      # Vue 组件
│       └── styles          # Css 样式
└── public                  # 存放静态资源
```

可以对应地进行新功能的添加或者旧站点的修改

下面放一个 Todo List 总之就是未来可期

- [x] 添加贡献者缓存
- [x] 搜索
- [ ] 每个栏目的自动导航组件
- [x] 添加 ignore 过滤读取的容
- [ ] 弄一个 tag 系统
- [x] 添加公式渲染
- [ ] 添加 todo 列表
- [ ] 添加主页贡献者[团队页面](https://vitepress.dev/zh/reference/default-theme-team-page)
- [ ] 生成 frontmatter
- [ ] 自定义`PageNav`

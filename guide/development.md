# 参与开发

项目地址：[YuuFrag](https://github.com/MarchHub/YuuFrag)

## 本地开发

项目的持续集成环境使用 Node.js 22 和 pnpm 9，建议本地使用相同版本。

```bash
git clone https://github.com/MarchHub/YuuFrag.git
cd YuuFrag
pnpm install --frozen-lockfile
pnpm docs:dev
```

开发服务器启动后，按照终端输出的地址在浏览器中打开站点。修改 Markdown、
VitePress 配置或主题组件时，页面会自动更新。

提交改动前运行完整检查，并验证生产构建：

```bash
pnpm check
pnpm docs:build
pnpm docs:preview
```

`pnpm check` 会依次检查待提交文件中的敏感信息、TypeScript/Vue 类型和单元
测试。`pnpm docs:build` 会生成 Tag 数据并将站点构建到 `.vitepress/dist`；
`pnpm docs:preview` 用于在本地预览该构建产物。预览地址以终端输出为准。

## 贡献流程

1. 在 GitHub 上 Fork 项目，并将自己的 Fork 克隆到本地。
2. 从最新的 `main` 分支创建功能或修复分支。
3. 使用 `pnpm docs:dev` 开发并检查页面效果。
4. 运行 `pnpm check` 和 `pnpm docs:build`。
5. 提交改动并向上游仓库的 `main` 分支发起 Pull Request。

## 贡献者缓存

构建时会从环境变量 `GITHUB_TOKEN` 读取 GitHub Token，并拉取每篇 Markdown
文件的提交贡献者。贡献者数据缓存到 `.vitepress/cache/github-contributors.json`，
头像缓存到 `public/contributors`，两者都是构建生成内容，不应提交到 Git。

如需在本地刷新贡献者数据，先创建本地环境文件并填写 Token：

```bash
cp .env.example .env
pnpm docs:build
```

发布产物中的贡献者头像来自本地 `/contributors` 路径，页面渲染不依赖 GitHub
头像服务。未设置 Token 或 GitHub 请求失败时，构建会回退到已有缓存；首次构建
且没有缓存时，页面不会显示贡献者数据。

真实 Token 只能写入已被 Git 忽略的 `.env`，不要写入 `.env.example`，也不要
使用会暴露到客户端的 `VITE_` 前缀。`pnpm docs:build` 本身不会执行敏感信息
检查；请使用 `pnpm check:secrets` 单独检查，或在提交前运行完整的 `pnpm check`。

## 项目结构

```text
.
├── posts/                  # 用于展示的笔记
├── about/                  # 贡献者介绍
├── guide/                  # 站点维护与参与指南
├── tags/                   # Tag 索引与聚合页入口
├── .vitepress/             # VitePress 配置与站点实现
│   ├── plugins/            # 自定义插件
│   ├── scripts/            # 导航、侧边栏和 Tag 生成脚本
│   ├── theme/
│   │   ├── components/     # Vue 组件
│   │   └── styles/         # CSS 样式
│   └── utilities/          # 路由、RSS 和 Tag 等通用逻辑
├── public/                 # 静态资源
├── scripts/                # 项目级检查与辅助脚本
└── tests/                  # 单元测试
```

## 功能状态

- [x] 添加贡献者缓存
- [x] 添加站内搜索
- [x] 自动生成分类导航与侧边栏
- [x] 过滤不参与导航生成的目录和文件
- [x] 添加 Tag 系统
- [x] 添加公式渲染
- [x] 添加任务列表渲染
- [x] 添加贡献者团队页面
- [ ] 自动生成或补全 Frontmatter
- [ ] 自定义 `PageNav`

# 参与开发

项目地址: [IdeonNotes](https://github.com/MarchHub/IdeonNotes)

```bash
git clone https://github.com/MarchHub/IdeonNotes.git
cd shared-blog
pnpm install
pnpm run docs:build
pnpm run docs:preview
```

即可在浏览器中查看构建好的站点（一切以应用台输出为主

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

- [ ] 添加贡献者缓存
- [x] 搜索
- [ ] 每个栏目的自动导航组件
- [x] 添加 ignore 过滤读取的容
- [ ] 弄一个 tag 系统
- [x] 添加公式渲染
- [ ] 添加 todo 列表
- [ ] 添加主页贡献者[团队页面](https://vitepress.dev/zh/reference/default-theme-team-page)
- [ ] 生成 frontmatter
- [ ] 自定义`PageNav`
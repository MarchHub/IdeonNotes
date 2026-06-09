# Rider 踩坑

在 Unreal Editor 的面板中创建 C++ 类时（不止是C++类，其他资产有时候也不行），在 Rider 中会显示无法追踪 Version

## 文件管理工作流

- 创建 C++ 类的时候直接通过 Rider 操作
- 蓝图以及其他资产则使用 Unreal Editor 创建
- 通过文件资源管理器或者 Rider 进行文件移动

操作之后尝试 `build` 或者 `Generate Project Files` 或者 热重载一下


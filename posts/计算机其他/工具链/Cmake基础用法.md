# Cmake Usage

简单记录Cmake使用

## 简述

Cmake 是跨平台的开源构建系统生成器。

使用的主要步骤——
1. 编写`CMakeLists.txt`文件，指挥如何构建以及定义依赖关系
2. 使用`Cmake`生成需要的系统构建文件
3. 执行构建文件，构建出可执行文件

## 基本指令

### `project(<name> [LANGUAGES ...])`

- 说明：声明项目名称与语言（C、CXX、Fortran 等）。
- 参数：`LANGUAGES` 可指定语言，缺省时 C 和 CXX 都可用
- 原理：设置一些变量（`PROJECT_NAME`、`PROJECT_SOURCE_DIR` 等），并初始化语言相关的检测。

### `add_executable(<name> [sources...])` / `add_library(<name> [STATIC|SHARED|MODULE|OBJECT|INTERFACE] [sources...])`

- 说明：定义构建目标（可执行文件或库）。
- 参数：库类型决定链接特性；`sources` 可列文件路径或使用 `target_sources()` 后期添加。
- 原理：这些命令向 CMake 的内部目标模型中注册目标节点，并在生成阶段使用这些节点来输出构建规则。
- 推荐：尽量只在命令中列出源文件的相对路径，或使用 glob 也可但不推荐（会导致文件新增时需手动重新运行 cmake）。

### `target_include_directories(<target> [SYSTEM] [BEFORE] <INTERFACE|PUBLIC|PRIVATE> dirs...)`

- 说明：为目标添加 include 搜索路径。
- 参数说明：
	- `SYSTEM`：将路径视为系统头（编译器对警告处理不同）。
	- `BEFORE`：在现有 include 路径之前插入（少用）。
	- `INTERFACE`/`PUBLIC`/`PRIVATE`：控制传递范围。
- 原理：设置目标属性 `INTERFACE_INCLUDE_DIRECTORIES` / `INCLUDE_DIRECTORIES`，根据使用关系在链接时传递路径。

### `target_compile_features(<target> <INTERFACE|PUBLIC|PRIVATE> cxx_std_17 ...)`
- 说明：请求编译器支持某些语言特性（例如 `cxx_std_11`, `cxx_std_17`）。
- 原理：CMake 根据编译器检测是否支持并在需要时添加合适编译选项。

### `target_link_libraries(<target> [PUBLIC|PRIVATE|INTERFACE] <lib>...)`

- 说明：链接库到目标，并控制库的传播属性。
- 说明细节：
	  - 当你使用 `target_link_libraries(A PUBLIC B)`，表示 A 链接 B，且 A 的 consumers 也需要链接 B 或至少能看到 B 的接口（头）。
	  - `INTERFACE` 用于 header-only 库。
- 原理：CMake 会根据链路图计算 link interface，并在生成阶段写出链接命令或在 MSVC 中把库加入项目引用。

### `find_package(<PackageName> [version] [REQUIRED|QUIET] [COMPONENTS ...])`

- 说明：查找已安装的外部包。
- 运行模式：
  - 使用 `Find<Package>.cmake` 模块（模块式查找）。
  - 使用 package-config 导出（例如 Eigen、PkgConfig）或通过 `<Package>Config.cmake`（配置文件）查找。
- 参数：`REQUIRED` 会在找不到时报错终止，`COMPONENTS` 用于拆分包的不同子模块。
- 建议：对于现代包（提供 `<Pkg>Config.cmake`），优先使用 `find_package(Pkg CONFIG REQUIRED)`；对于老包或系统包，保留模块查找作为 fallback。

### `include(<file>)` 与 `add_subdirectory(<dir>)`

- `include()`：在当前处理上下文中载入另一个 CMake 脚本（可用于复用宏/函数）。
- `add_subdirectory()`：将另一个含有 CMakeLists 的目录纳入当前构建，子目录可以定义自己的目标，且能访问 parent 的变量（按目录作用域规则）。
- 原理差异：`include` 更像把文件文本插入当前文件，`add_subdirectory` 会创建独立作用域及缓存项，但保留目标间的链接。

### `configure_file(<in> <out> [COPYONLY] [@ONLY])`

- 说明：在配置阶段复制并替换变量（例如生成版本头文件）。
- 参数：`@ONLY` 表示只替换 `@VAR@` 形式而非 `${VAR}`。

### `set(VAR value CACHE TYPE "doc")`

- 说明：设置变量并放入 CMake Cache，能在 gui 或命令行 `-D` 时被覆盖。
- 参数：`TYPE` 通常为 `STRING`, `BOOL`, `PATH` 等。
- 原理：CMakeCache 保存持久配置，后续 cmake 运行会读取缓存。注意：直接使用 `set()` 更改缓存需要把 `CACHE` 提供给 `set()`，否则只在内存作用域有效。

### `option(<VAR> "help" [ON|OFF])`

- 说明：创建一个布尔缓存变量，常用于开关功能（如 `BUILD_TESTING`）。

### `install(TARGETS ... DESTINATION ...)`

- 说明：安装规则，用于打包/安装库与可执行文件到目标路径（例如 `/usr/lib`, `/usr/include`）。
### `export()` / `install(EXPORT ...)`
- 说明：导出 targets 信息为 `<Package>Config.cmake` 的一部分，便于其它项目通过 `find_package()` 使用你的库。

### `compile_commands.json`

- 通过在顶层设置 `set(CMAKE_EXPORT_COMPILE_COMMANDS ON)` 可以生成 `compile_commands.json`，这对 `clangd` 或其它基于 JSON 的工具非常有用。

## 上述都是废话

上述都是废话，下面才是重点

思考一个项目 ——
- 定义项目名字
- 定义语言以及语言标准
- 定义引用了什么库，各种依赖之间的关系
- 生成可执行文件

所以可以得到一个最简`CMakeLists.txt`

```cmake
cmake_minimum_required(VERSION 3.10)

project(HelloCmake LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(PROJECT_SOURCES ${CMAKE_CURRENT_SOURCE_DIR}/src/main.cpp)

add_executable(ExecuteName ${PROJECT_SOURCES})
```

- `project` 指定项目名字以及使用语言
- `set` 设置变量值，这边之间对`cmake`内置常量进行修改
	- 定义`C++`标准为`C++17`
- `set` 定义源文件的路径在`sourcedir/src/main.cpp`
- `add_executable` 指定源文件，以及输出的可执行文件名字

如果现在源文件中，调用了外部库，就需要在文件中写清楚调用了哪里的什么。

### 源码构建

假设把库的源码拉去到了项目之中，需要在第三方库的根目录下也有一个`CMakeLists.txt`来说明此第三方库是如何构建

并且在项目的根目录调用——
- `add_subdirectory` 把子目录加入构建
- `target_link_libraries` 把子目录构建后的库链接到项目之中
- `target_include_directories` 声明编译器在编译该目标的源文件时，额外去哪些目录查找 `#include` 引用的头文件

### 预编译库

对于已经编译好的 .a/.lib/.so 可以直接链接
```cmake
add_library(extlib STATIC IMPORTED)
# 设置目标库的属性
set_target_properties(extlib PROPERTIES IMPORTED_LOCATION "/usr/lib/libext.a")
# 链接上库
target_link_libraries(myapp PRIVATE extlib)
```

### 系统安装过的

使用`find_package`来自动查找，很是方便

```cmake
find_package(Boost REQUIRED COMPONENTS filesystem)
target_link_libraries(myapp PRIVATE Boost::filesystem)
```


### 动态构建

一般用于在构建从 Git/Url 下载的代码等，以`fmt`作为例子
```cmake
include(FetchContent)
FetchContent_Declare(fmt GIT_REPOSITORY https://github.com/fmtlib/fmt.git)
FetchContent_MakeAvailable(fmt)
target_link_libraries(myapp PRIVATE fmt::fmt)
```
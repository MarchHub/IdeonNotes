# Asset Hot Reload

如果在运行时遇到了 Assets 发生变化,如何在不重启程序的情况下重载 Assets ? —— 常说的对资产的热重载就是为了解决这样一件事情 (什么 Code Hot Reload 那些更复杂的东西未来可期)

## 流程简述

显然,首先要先检测到 Asset 的变化. 接着重新 Load 之, 做一个 Runtime Assets 的替换,最后使用就好. 以上!

如果不考虑其他任何事情,确乎就是这么简单的链条 —— Detect -> Reload -> Replace 即可

这边提供一个非常小的 Playground

```C++

namespace fs = std::filesystem;

int main()
{
    const fs::path path = "asset.txt";

    // Runtime Asset
    std::string asset;

    // 读取磁盘 Source Asset
    auto reload = [&]
    {
        std::ifstream file(path);

        std::getline(file, asset);

        std::cout << "asset = " << asset << '\n';
    };

    // 第一次加载
    reload();

    auto lastWriteTime = fs::last_write_time(path);

    while (true)
    {
        auto currentWriteTime =
            fs::last_write_time(path);

        // Detect
        if (currentWriteTime != lastWriteTime)
        {
            lastWriteTime = currentWriteTime;

            // Reload + Replace
            reload();
        }

        std::this_thread::sleep_for(
            std::chrono::milliseconds(500));
    }
}
```

非常的简单,利用修改时间来进行 Check 资产是否被修改

不过也是很显然的,会出现很多问题,于是 Asset System 变得愈发庞大(

## Reload Failed

在检测到 Asset 修改之后进行 Reload 的时候, 遇到新的 Asset Reload 失败 —— 如果我们的策略是先杀死旧的资产再载入新的资产,那么恭喜,Runtime 的时候就什么都没有了,旧的被杀,新的没来

所以一般来说,不会先删旧资产,而是先加载进来,再做一次 Validate, 如果 Validate 成功的话再替换,否则报个错之类的然后先保留旧数据

## Stable Identity

假设一个 Texture 是 `Texture* data`, 然后这个地址被多个系统同时持有(比如 Renderer Scene Material 等), 那么当我们只是简单的执行 `delete data` 然后再 `data = new ...` 的话,显然旧的系统中持有的就是垂悬指针, 所以我们需要引入一个稳定的身份标识 ——

此时很久之前说的 Handle 就非常合适, 我们在对于旧的资产数据进行重载的时候,只要 Handle 不变,就可以让所有持有这个 Handle 的系统所持有的数据进行一个“原地替换”

## 资产依赖问题

实际上资产之间会有比较复杂的依赖关系,比如我们修改了 Vertex Shader, 在重载的时候不仅要重新编译自己这个文件, 还可能涉及 Material 的变化, Pipeline 的重建等.

也就是说,一次 Asset 的变化,可能会引起某些资产管线的重建,此时比较常见的做法是建立一个依赖图,然后对于一个 Dirty 数据,沿着依赖图进行传播 Dirty 标记(图的遍历),最后在所有标记 Dirty 的部分进行重建

用 Dirty 来进行标记之后,可以直接 Rebuild, 不过也有个比较常见的做法,就是 Lazy Rebuild —— 比如修改了一个 Shader 但是有 1m 个 Pipeline 需要重建,那每次修改也太贵了,于是就可以仅仅标记 Dirty 之后在使用到的时候进行一个 Check 然后重建即可,不赖.

不过还是严谨的说下,资产哪怕有依赖也不一定就是要求重建,这边借用一下 [Bevy](https://github.com/bevyengine/bevy) 的说明

> - normal dependencies: dependencies that must be loaded as part of this asset load (ex: assets a given asset has handles to).
> - Loader dependencies: dependencies whose actual asset values are used during the load process

源码的话可以查看他们[loader](https://docs.rs/bevy_asset/latest/src/bevy_asset/loader.rs.html)的写法

意思上说就是要“区别对待”, 有依赖关系也可能不会触发重建

(最后提供一下在自己那个 ChikaEngine 的做法 —— 触发了Hot Reload? 直接全部重建!! 简单粗暴)

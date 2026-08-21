# PImpl

Pointer to Implementation, 其核心思想是让公开类只保存一个指向真正实现对象的指针,保证对外暴露稳定干净的接口,同时隐藏掉内部的实现细节

## 简单例子

假设我们有一个数据库,需要对外暴露`Connect`和`Query`两个接口,先假设不使用PImpl写法 —— 我们可能会让 Database 类直接拥有`Socket`和`ConnectionPool`

```C++
class Database
{
public:
    void Connect(std::string_view address);
    void Query(std::string_view sql);

private:
    Socket socket_;
    ConnectionPool pool_;
};
```

然后在实现当中对外暴露的方法直接操控`socket_`和`pool_`成员变量来进行实现,这完全没有问题.

不过因为 `Socket` 和 `ConnectionPool` 是 `Database` 的直接成员，编译器在看到 `Database` 的完整定义时必须知道它们的完整类型，才能确定 `Database` 的 object layout、`sizeof` 和 alignment。因此 `Database.h` 通常需要包含这些类型对应的头文件 —— 导致在调用`Database`类型的文件中,就会被迫引入大堆“杂物”.

不过好一点的写法 —— 前向声明然后使用指针来进行成员的声明

```C++
class Socket;
class ConnectionPool;

class Database
{
private:
    Socket* socket_;
    ConnectionPool* pool_;
};
```

这样可以降低部分头文件依赖的问题,有一点PImpl的雏形在了

不过如果我们的实现进一步复杂,或者做了修改,那么依旧会使得 Database 的 header 肥硕, 同时公开头文件仍然暴露了内部组成结构

那么使用了 PImpl 的写法 ——

```C++
class Database
{
public:
    Database();
    ~Database();

    void Connect(std::string_view address);
    void Query(std::string_view sql);

private:
    class Impl;

    std::unique_ptr<Impl> impl_;
};
```

其实也只是“激进”了一些 —— 干脆把所有的实现具体都封装到 Impl 类型中, 然后把实现全放在 .cpp 文件下,这样就彻底隔离开了在具体引用 Database 的时候那些不必要的头文件

## 好处

首先是依赖隔离,我们上层业务代码仅仅依赖到`Database`就停止了,不会继续往下依赖`Socket`等

其次是调用方在编译的时候可以不需要知道具体实现 —— 对调用方隐藏实现,大抵也算一种隔离.

与此同时,在修改部分代码的时候,可以减少编译的文件数量 —— 比如修改了 Socket 的内容,传统写法会认为 main -> Database -> Socket 导致全部进行重编译,即所有调用 Database 的都会因为底层 Socket 的修改而重新编译,这很坏. 而新玩法会让 main -> Database; Database -> Socket; 这样对于这个依赖链来说,通常只需要重新编译直接依赖 `Socket` 的 `Database.cpp`, 十分甚至九分的不赖

此外,也有助于保持 ABI 稳定 —— 如果直接给 `Database` 增删成员，其 `sizeof`、alignment 或成员布局可能发生变化，使已经按旧布局编译的调用方与新版动态库产生不一致,而使用 PImpl 后,变化主要发生在指针后的 `Impl` 中,而公开的 `Database` 对象布局可以保持不变,因此内部成员调整通常不会直接破坏调用方依赖的 object ABI

## Bridge

写法上感觉有点像是 Bridge 模式 —— 因为两者都会在外层对象和真正实现之间加入一层间接关系

```C++
class Renderer
{
	std::unique_ptr<RenderBackend> _backend;
}
```

然后可以在构造的时候传入不同的实现,比如Vulkan/DX12/OpenGL等

也是隐藏了具体实现细节,某种程度上还是有点像的(
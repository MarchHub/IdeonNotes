---
tags:
  - C++
  - 错误处理
---

# Exception

Error 是问题 (~~废话~~), 那么一般来说可以分为编译期发现的和运行期间发现的. 此处简单说下 C++ 提供的一套在 Runtime 的时候对于 Error 的捕获,传播,处理等的机制 —— 也就是 Exception Handling

简单来说,这是一套可以主动报告 Failure，并把 Failure 沿调用栈传递给某个 Handler.

(关于 runtime error 的其他处理机制, 比如 std::option, std::expected 等,等开其他笔记再说, 此处聚焦 try-catch, throw 以及 exception 这套机制)

## 简单例子

```C++
void Load()
{
    throw std::runtime_error("load failed");
    std::cout << "Load End" << '\n';
}

int main()
{
    try
    {
        Load();
    }
    catch (const std::exception& e)
    {
        std::cerr << e.what() << '\n';
    }

    std::cout << "continue\n";
}
```

按照顺序执行, 先进入 `Try` 语句, 尝试执行 `Load`, 如果 `Load` 中出现了 throw 的 exception, 则会被 catch 匹配, 然后执行 catch 中的代码块, 执行之后继续按照顺序执行(**直接执行 try-catch 后的语句**). 所以上述代码的输出结果为 ——

```
load failed
continue
```

## 解决问题

那么这解决了一个什么问题呢 —— 当前层级的 Err, 自己可能不能处理, 要交付给上层进行处理

实际例子 ——

```
Application::LoadScene
        ↓
SceneLoader::Load
        ↓
TextureLoader::Load
        ↓
FileSystem::Read
```

然后 `FileSystem::Read` 挂了, 读取文件失败 —— 但是自己可能不能解决这个 Err, 因为文件损坏 / 没有读取权限等之类的有可能有多个问题导致文件失败,这不是 Read 方法可以自己解决的事情, 无奈, 只能把 Err 报告给上层,看看上面怎么处理.

此处有两种处理方式 ——

一是使用 Error Value 进行传播

```C++
Result ReadFile()
{
    if (failed)
        return Error;
}

Result LoadTexture()
{
    auto result = ReadFile();

    if (!result)
        return result.error();

    ...
}

... // 再上层也同理
```

`std::expected<T, E>`、LLVM `Expected<T>`、Abseil `StatusOr<T>` 都属于这种实现, 非常的不赖, 也挺优雅的.

那么另一种就是使用 Exception 来进行捕获

```C++
File ReadFile()
{
    if (failed)
        throw FileError(...);
}

Texture LoadTexture()
{
    File file = ReadFile();

    ...
    // 就是正常编写逻辑
}
```

然后只需要在有能力处理这个 Error 的调用层写 ——

```C++
try
{
    LoadScene();
}
catch (const FileError& error)
{
    ...
}
```

也就是在 “调用者” 处进行错误的捕获和处理.

那么这样实现的好处是可以让 Err 越过若干层级, 直接跳到可以处理它的调用层进行处理

## Exception Object

当程序执行到

```C++
throw std::runtime_error("load failed");
```

的时候, 是实例化一个 `Exception Object` 对象, 并且记录信息, 让后面捕获这个 Exception 的地方可以进行一些处理

首先 `std::exception` 这个基类 ——

```C++
class exception
{
  public:
    virtual ~exception() noexcept;
    virtual const char* what() const noexcept;
};
```

(被删的差不多的 exception)

也就是说, 所有实现了这个接口的 exception 都有一个 `what` 接口,可以用于自己 override 记录错误的基础信息等

那么上面的 `std::runtime_error` 就是一个实现了 `std::exception` 的 exception, 其核心依旧是这个 `what`, 主要保存一段描述问题的信息

不过值得注意的是, throw 不是被限制要 throw 一个 `exception` 的接口, 而是可以 throw 其他什么, 比如 ——

```C++
throw 114514;
throw SomeClass{};
```

## Throw 之后

(以下不是 C++ Standard 规定的具体实现方式，而是 Itanium C++ ABI 下 GCC/Clang 等常见实现使用的一套典型机制)

最需要关注的点在于 —— 在遇到 Throw 语句之后, 如何向上传播.

可以简单查阅一下 [Itanium ABI 文档](https://itanium-cxx-abi.github.io/cxx-abi/abi-eh.html) ——

```C++
temp = __cxa_allocate_exception(sizeof(X));

// construct X into temp

__cxa_throw(
    temp,
    type_info<X>,
    destructor<X>
);
```

这里就定义了几件事情要做 ——

1. 准备一块能够保存 Exception Object 的空间
2. 在这块空间中真正构造 `X`
3. 把这个 Exception Object 交给 C++ Exception Runtime
4. Runtime 同时记录
	1. 它是什么类型
	2. 最后应该怎么销毁它
5. 开始沿调用栈寻找能够处理它的 Handler

首先建立独立 Exception Object 的原因是 —— 如果 throw 来一个局部变量, 则会的当前的 Stack Frame 结束之后被销毁, 其声明周期无法保证它可以被传播到可以处理它的地方

接着记录 type_info 是为了在 `catch` 中可以进行类型匹配 ——

```C++
catch (const std::runtime_error&)
catch (const FileError&)
...
```

这样的代码可以让 throw 出来的对象正确进入分支

同时 `destructor` 是为了保证其声明周期 —— 在 catch 之后可以被正常释放掉

我们准备好了所有东西, 接下来就是如何传播的事情了 ——

假设还是“解决问题”那个部分中的读取文件的例子, 我们会有一个调用链 ——

```
Caller
 ↓
LoadScene
 ↓
LoadTexture
 ↓
ReadFile
```

此时必须让 exception 随着 `ReadFile` 沿着这个路径一直找到 `Caller` 身上.

显然, 此时涉及到栈帧的切换,所以需要涉及`Stack Unwinder`的事情, 简单来说, 就是让 Exception 向上传播的时候, 因为会离开一个栈帧, 所以需要对其作用域内的已经构造的局部对象进行释放, 然后继续向上传播.最后找到 Catch 为止. 看 catch 如何处理, 处理之后从 `try-catch` 块之后继续执行

不过实际上在 Itanium C++ ABI 的典型实现模型中其实有两个阶段 ——

1. 先做查找, 仅查找 catch 在的栈帧, 而不做销毁, `_UA_SEARCH_PHASE`
2. 进行 Stack Unwinding, 并执行沿途需要的 Cleanup / Destructor, 一路走到 catch 的位置, `_UA_CLEANUP_PHASE`

(其中实际上比较复杂的编译原理, 未来可期一下, 此处重点还是 C++ 的理解, 所以先极度化简下)

此处为了保证资源可以被正常的销毁, 也是依赖 RAII 来进行管理, 保证没有资源泄露.

不过哪怕利用 RAII 保证资源的释放正常, 也无法保证资源的逻辑正确. 比如 ——

```C++
void Config::Update(const NewConfig& newConfig)
{
    name_ = newConfig.name;
    Validate(newConfig);     // throw
    path_ = newConfig.path;
}
```

那么此时 `config` 的状态就是名字是新的,但是路径是旧的, 所以工程上还会提出 `Exception Safety Guarantee` 这样的概念.

感觉继续写会导致文章职责膨胀, 下次一定. 简单来说就是保证 Throw 之后我们最好依旧可以保证变量逻辑正确 (比如先做所有有可能 throw 的操作, 最后再统一 commit)

```C++
void Config::Update(const NewConfig& newConfig)
{
    Config temp = *this;

    temp.name_ = newConfig.name;
    temp.path_ = newConfig.path;

    Validate(temp);

    std::swap(*this, temp);  // commit
}
```

## noexcept

`noexcept` 用于声明一个函数**不允许 Exception 从该函数边界逃逸**. 如果 Exception 实际试图逃出一个 `noexcept` 函数, 程序会调用 `std::terminate()`, 尤其是 `destructor` `move` `swap` 之类的方法非常的有意义 ——

简单来个例子, 假设析构函数可以参与exception的传播链条 ——

```C++
class File
{
  public:
    ~File() noexcept(false) { throw CloseError{}; }
}

void Foo()
{
	File file;
	MaybeThrow();
}
```

系统在执行 `MaybeThrow` 的时候开始处理异常, Stack Unwinding 自动调用了 `~File()`, 而 Destructor 在执行过程中又抛出了第二个 Exception, 并让它逃出了 Destructor. 那么就会直接调用 `std::terminate()` 终止程序

原因是一个异常正在被尝试处理, 但是同时另一个异常又被系统自动掉其被抛出, 那么不管是继续处理第一个异常, 还是放弃第一个异常去处理第二个异常, 都会有很多问题(资源管理就是一大难题), 所以会直接调用 `std::terminate()`

因此, 对于可能在 Stack Unwinding 中承担 Cleanup 的操作,尤其是 Destructor,应当保证 Exception 不会逃逸

与此同时, 对于承担 commit / resource transfer 职责, 并且实现本身确实能够保证不抛异常的 Move / Swap, 应该尽可能提供 `noexcept`. 这样 generic code 才能够利用这一性质建立或维护 Strong Exception Guarantee —— 还是举例子 —— 标准库里的 `vector` 在 realloc 的时候

```
old storage
[A][B][C]
     ↓
new storage
```

假设在 move A, B 的时候正常, 但是在 move C 的时候抛出异常, 那么此时很难保证 Strong Guarantee, 于是 `std::move_if_noexcept` 的策略是 —— 如果可以 move 是 noexcept 就 move, 如果不是, 则使用 copy

## 好的写法

在明确可以处理 exception 的时候再写, 而不是 catch 语句到处写. 同时设计类型的时候最好考虑针对不同的策略 —— 每种策略对应一种类型, 而不是写一堆类型.

### Exception Hierarchy

假设我们全部使用 `std::runtime_error(message)` 那么在 catch 之后做字符串匹配, 就显得非常愚蠢. 而是可以通过实现 `exception` 的接口, 然后做类型匹配

```C++
class AssetError : public std::runtime_error
{
public:
    using std::runtime_error::runtime_error;
};

class AssetNotFoundError : public AssetError
{
public:
    AssetNotFoundError(Path path)
        : AssetError("asset not found"),
          path_(std::move(path))
    {
    }

    const Path& PathValue() const noexcept
    {
        return path_;
    }

private:
    Path path_;
};

class AssetDecodeError : public AssetError
{
public:
    using AssetError::AssetError;
};
```

这种利用继承树的实现也可以让调用处可以自己选择处理粒度 ——

```C++
try
{
    LoadAsset(path);
}
catch (const AssetNotFoundError& e)
{
    UseFallbackAsset();
}
catch (const AssetDecodeError& e)
{
    ReportCorruptedAsset(e);
}
catch (const AssetError& e)
{
    ReportAssetFailure(e);
}
```

借助同一个 `try` 对应的 handlers 会按照源码出现顺序依次进行 matching 的特性, 所以写的顺序也要从细粒度到粗粒度,最后“兜底”这样来写

### Catch-All Boundary

最好还是先匹配类型, 然后通过 `...` 来进行兜底 ——

```C++
try
{
	RunApplication();
}
catch (const std::exception& e)
{
	LogFatal(e.what());

	return EXIT_FAILURE;
}
catch (...)
{
	LogFatal("unknown exception");

	return EXIT_FAILURE;
}
```

### Rethrow

当前层有时不能真正处理 Exception，但可能需要完成某些必要的附加工作，之后继续传播原始 Exception，此时可以使用 `throw;`

```C++
try
{
    Load();
}
catch (const AssetError& e)
{
    AddTrace(e);

    throw;
}
```

这样的语义是 —— 当前层不能处理，只进行必要的附加工作，然后继续传播原异常

不过值得注意的是, 此处如果写成`throw e;`的话, 语义又完全不同,而是类似下一个文段说的内容.

于此同时, 可能会出现 `object slicing` 的问题, 即根据当前 e 的静态类型进行创建 throw 对象之后再进行传播, 可能会只剩下基类那部分数据

### Exception Translation

此处的语义是把当前匹配到的 throw 做一次重新的打包, 成为自己系统中的 Error 传播对象

```C++
try
{
    ReadFile(path);
}
catch (const std::filesystem::filesystem_error& e)
{
    throw AssetLoadError(
        AssetErrorCode::IOError,
        path,
        e.what()
    );
}
```

这样会重新开启一个新的 throw exception 的传播链条

## 总结

> [!note] Don’t try to catch every exception in every function.

不要在各个函数中都写 catch, 而是在明确可以处理某种 exception 的时候再写;

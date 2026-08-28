---
tags:
  - ChikaEngine
  - C++
  - 性能分析
---

# SmallJobFunction

实现一个简单的 Function Wrapper, 让传给 Job System 的 Callable 在 Runtime 打包

## 主要解决问题

我们在使用 Job System 的时候, 大概率会这样调 ——

```C++
jobs.Schedule("Physics", [] {
    UpdatePhysics();
});

jobs.Schedule("Load", [path] {
    LoadAsset(path);
});

jobs.Schedule("Something", [ptr = std::move(ptr)] {
    ptr->Run();
});
```

用 Lmabda 很方便,但是她们都是不同的类型, 所以比较不容易进行在 Runtime 存储, 或许确乎是可以使用`std::function<void()>`这个强大的工具来进行封装

不过这会遇到一些问题 ——

- 它要求封装的 callable 是可复制的
- 它的实现通常有 SBO，但超出实现提供的小对象缓冲区后，可能产生 heap allocation

所以此处使用了一个 **128-Byte** 并且 **Move-Only** 的一个数据结构

而仅允许移动可以解决两件事情 ——

- 捕获仅允许移动的 Callable (比如带 `unique_ptr` 的 Lambda)
- 让资源符合「调用者 -> JobDesc -> JobStorage -> JobSlot」 的移动,并且不是乱复制,而是每一次的转交都是转交所有权

## 核心设计

实际上里面打包的成员变量只有 ——

```C++
alignas(std::max_align_t)
std::byte m_storage[InlineSize]{};

void (*m_invoke)(void*) = nullptr;
void (*m_move)(void*, void*) = nullptr;
void (*m_destroy)(void*) = nullptr;

static constexpr size_t InlineSize = 128;
```

(超级简化后的手写 vTable)

### 对象存储

首先这个 `m_storage` 是为了在传入 Callable 的时候进行原地构造然后存储 ——

```C++
using Stored = std::remove_cvref_t<Function>;
new (m_storage) Stored(std::forward<Function>(function));
```

同时在构造前的时候进行检查 ——

```C++
static_assert(sizeof(Stored) <= InlineSize, "Job callable exceeds SmallJobFunction inline capacity");
static_assert(alignof(Stored) <= alignof(std::max_align_t), "Job callable requires unsupported alignment");
static_assert(std::is_nothrow_move_constructible_v<Stored>, "Job callable must be nothrow move constructible");
```

分别保证了 ——

- Callable <= 128 bytes
- storage alignment 足够
- Callable 必须 nothrow move constructible

其中第三点比较有意思 —— 因为在自身执行赋值和移动构造的时候声明了 `noexcept`, 所以如果传入类型的构造会产生 exception 则和当前的声明冲突, 不能保证之后可以安全 move. 所以在此处也进行一个断言

### 函数指针

先看 `m_invoke`, 最重要的类型擦除就藏在此处 ——

```C++
m_invoke = [](void* storage) {
	(*static_cast<Stored*>(storage))();
};
```

拆解一下, `m_invoke` 是记录一个无返回值的,传入一个地址的函数指针

然后看 lambda 内部 —— 传入一个地址,然后转化成 `Stored*`类型,再解引用进行 Callable 的调用. 比较妙的一点是 Stored 类型只在构造的时候会被我们接收,所以只能在此时进行记录,就是使用一个这样的Lambda 进行记录. 最后在之后调用的时候就不需要考虑 Callable 的具体类型, (类型擦除), 而是直接使用 m_invoke 进行调用即可( 而且 Callable 的地址也被我们的 `m_storage` 所记录, 并且存在此处, 于是仅 `m_invoke(m_storage)` 就可以完成对传进来的 callable 进行调用, 不赖)

(btw, 无捕获 lambda 可以隐式转换为对应的普通函数指针, 所以可以被当前这个函数指针记录)

接着看 `m_destroy` ——

```C++
m_destroy = [](void* storage) {
	static_cast<Stored*>(storage)->~Stored();
};
```

之所以需要手动实现一个 Destroy 来调用析构函数, 是因为在编译的时候,编译器只知道我们有一个`std::byte`类型的数组,但是并不知道其中存了一个 Callable, 所以在编译器实现析构的时候大概率是 default, 从而仅析构掉了`std::byte`这个东西,但是不会执行 Callable 的析构, 这可能会导致内存泄露的问题 —— 比如 Callable 中声明了一个 `std::unique_ptr<int> p`,那么 p 所指向的堆区内存就还会存在, 而不会被释放. 这很坏. 不过更多可能是生命周期管理的问题吧 —— 这个通过 placement new 创建的对象因为不会执行自己的析构逻辑, 从而破坏 RAII 语义

而还是我们仅在构造函数的时候会知道 Stored 的类型,从而可以访问到其析构函数, 于是便在此时记录函数指针, 在 SmallJobFunction 析构的时候手动先执行一下 (RAII封装)

### Move

手动实现了 Move ——

```C++
m_move = [](void* source, void* destination)
{
	new (destination) Stored(std::move(*static_cast<Stored*>(source)));
	static_cast<Stored*>(source)->~Stored();
};

void MoveFrom(SmallJobFunction&& other) noexcept
{
	m_invoke = other.m_invoke;
	m_move = other.m_move;
	m_destroy = other.m_destroy;
	if (m_move)
		m_move(other.m_storage, m_storage);
	other.m_invoke = nullptr;
	other.m_move = nullptr;
	other.m_destroy = nullptr;
}
```

分开了说, 先看 `m_move` 这个函数指针, 它负责把 source 为首地址记录的内存块中的 Callable 使用移动构造, 存储到 destination 中, 然后再析构掉 source

值得注意的是, 此处移动的不是整个 SmallJobFunction 对象,而仅仅是其中被类型擦除掉的 Callable 对象.

此处也是借助构造的时候可以知道 Stored 类型, 这样在 Runtime 的时候就可以直接借助函数指针进行操作.

接着在真实的使用当中,出发移动构造的时候 ——

```C++
SmallJobFunction(SmallJobFunction&& other) noexcept
{
	MoveFrom(std::move(other));
}
```

所以此时我们继续看 `MoveFrom` 函数 —— 它的职责就是把整个 `SmallJobFunction other` 的内容转移到当前 `SmallJobFunction`

前面赋值和调用 move 比较容易懂, 后面把 other 的三个指针置空的作用 —— 生命周期管理!

重点说下 other.m_destroy, 如果不把它重置掉, 那么在 other 结束其声明周期的时候, 会调用自己的析构函数执行一次 `m_destroy(m_storage);`, 而 `m_move` 已经显式析构了 `other.m_storage` 中原本的 Stored 对象。如果还保留 `other.m_destroy`，那么 `other` 后续析构时会再次把同一块 storage 当成一个活着的 Stored 并执行析构，造成 double destruction 和 UB

这样的设计十分甚至九分的符合移动语义下的移交生命周期管理.

### 模板和引用转发

```C++
template <typename Function>
    requires(
        !std::same_as<
            std::remove_cvref_t<Function>,
            SmallJobFunction
        >
    )
explicit SmallJobFunction(Function&& function)
```

先看模板 —— 简单来说, 我们需要传入一个类型, 把 `Function` 顶层的 `const/volatile` 和引用修饰去掉以后如果得到的类型是 `SmallJobFunction` 本身, 就禁止这个模板构造函数参与匹配


引用转发就比较常见了, 这样左右值都可以作为参数传递, 然后具体的转发在上文有写到(

不过依旧提供例子 ——

```C++
auto callable = [] {};

SmallJobFunction a(callable);
SmallJobFunction b([] {});
```

---
tags:
  - C++
  - 函数式编程
  - 类型系统
---

# function

可恶,如此常用的东西居然没有单独写一篇,我有罪

简单来说,就是一个可调用对象(Callable Object)的容器

## 可调用对象

简单点 —— `f(a, b, c)` 这样的 f 在参数下可以形成合法的"调用行为",就是可调用对象(词穷,意会一下)

那么在现代 C++ 的语义中,`std::invoke(f, a, b, c)`语句如果成立的话,则说明这是Callable的 ——

> [!note] 对给定的 `f` 和参数 `args...`，如果 `std::invoke(f, args...)` 是合法表达式，那么可以认为 `f` 在这组参数下是 Invocable / Callable。

所以说普通的函数,函数指针,Functor,Lambda等都是比较常见的Callable

```C++
// 1. 普通函数
void Foo()
{
}

// 2. 函数指针
void (*fp)() = Foo;

// 3. Lambda
auto lambda = [] {
};

// 4. 带 operator() 的对象，也叫 function object / functor
struct Task
{
    void operator()() const
    {
    }
};

Task task;
task();
```

## 基础语法

```C++
std::function<返回类型(参数类型...)> name;
std::function<void()> f;                // 返回值是 void 没有参数的可调用对象
std::function<bool(float, int)> f;      // 返回值是 bool 传入一个 float 和 一个 int 作为参数
```

上面是定义,然后使用的话 ——

```C++
std::function<void()> f = [] {
    std::cout << "lambda\n";
};

f();
```

## 一些理解

Callable 是一族对象,他们具体的类型是不一样的,lambda/functor等都是不同类型,但是如果调用方式相同(可兼容的返回值,可兼容的参数),则可以使用 `std::function` 进行统一的包装来进行抹除类型差异 —— 因为封装之后全部都是 `std::function` 类型了.

那么这样我们在写什么会调函数/Event Bus 等,就可以把它当作委托来进行代码的编写了 ——

```C++
class Button
{
public:
    void SetOnClick(std::function<void()> callback)
    {
        callback_ = std::move(callback);
    }

    void Click()
    {
        if (callback_)
        {
            callback_();
        }
    }

private:
    std::function<void()> callback_;
};

Button button;

button.SetOnClick([] {
    std::cout << "Clicked\n";
});
```

### F&&

我们也经常会看到下面的代码

```C++
template<typename F>
void Invoke(F&& f)
{
	f();
}
```

先从直观上来说,直接 ——

```C++
template<typename F>
void Invoke(F f)
{
	f();
}

auto task = [] {
    Work();
};

Invoke(task);
```

已经可以实现对于 Callable Object 的调用了,但是为什么要使用 forwarding reference 呢?

首先这种实现的话,默认是按值接收需要在内部构造一个自己的 `F` 对象,而传入左值的时候基本上是触发复制构造,那么 Lambda 等对象复制也是有成本的,而且如果对于只能移动的对象来说,这样就会挂掉(当然,也可以手动写move)

稍微优化一下写

```C++
template<typename F>
void Invoke(F& f)
{
	f();
}
```

也不是不行,但是左值引用的话就无法传入临时变量了 —— 即下面写法是非法的

```C++
Invoke([] {
    (void);
});
```

因为临时对象是右值无法作为参数传入.

好,那我们再加入 const 使得临时对象也可以传入 ——

```C++
template<typename F>
void Invoke(const F& f)
{
	f();
}
```

那么以下非“const-callable”又是非法的了,比如

```C++
auto task = [count = 0]() mutable {
    ++count;
};
```

( 经典 operator() 不是 const )

如果完整写转发的话 ——

```C++
template<typename F>
decltype(auto) Invoke(F&& f)
{
    return std::invoke(
        std::forward<F>(f)
    );
}
```

综上所述,使用 forwarding reference 在不太确定 callable 的 copy/move/const/value category 的情况下确实是一个不错的 API 设计,不过在确定的情况下,按需选取签名!

不过 template 确实爽,但是也会造成编译期展开代码太多(毕竟对每种类型都会做展开)等问题

## 坑点

`std::function` 本身要求对象是可复制的,比如下面的`task`就无法被`function`存储

```C++
auto task =
    [ptr = std::make_unique<int>(42)] {
        Use(*ptr);
    };
```

可以理解成 ——

```C++
struct Lambda
{
    std::unique_ptr<int> ptr;

    void operator()() const
    {
        Use(*ptr);
    }
};
```

又因为 `std::unique_ptr<int>` 是 MoveConstructible 而不是 CopyConstructible, 所以它的 Wrapper 这个 Lambda 表达式也是 MoveConstructible, 就会导致

```C++
std::function<void()> f = task;
```

这行代码无法通过编译,也比较直观 —— 因为 `task` 是左值, 需要复制 Callable, 而它又不能复制(

但有意思的是,即使我们写 ——

```C++
std::function<void()> f = std::move(task);
```

依旧无法通过编译,因为`std::function` 自己具有复制语义,即 ——

```C++
std::function<void()> f1 = ...;

std::function<void()> f2 = f1;
```

要保证这样的复制语句要可以成立,所以要求它内部保存的 Callable 也必须能够被复制,那么为了应对这种情况,C++23也提出了 `std::move_only_function` 这样一个对象(未来有机会再展开

## 总结

可以使用`std::function`实现对callable object的封装,实现类型擦除,同时也可以是 runtime 中存储 Callable Object 的好容器

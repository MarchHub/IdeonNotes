---
tags:
  - C++
  - 资源管理
---

# RAII

## 简述

全称**资源获取即初始化**（英语：**R**esource **A**cquisition **I**s **I**nitialization）

> RAII要求，资源的有效期与持有资源的[对象生命周期](https://zh.wikipedia.org/wiki/%E5%AF%B9%E8%B1%A1%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F "对象生命周期")严格绑定，即由对象的[构造函数](https://zh.wikipedia.org/wiki/%E6%9E%84%E9%80%A0%E5%87%BD%E6%95%B0 "构造函数")完成[资源的分配](https://zh.wikipedia.org/w/index.php?title=%E8%B5%84%E6%BA%90%E7%9A%84%E5%88%86%E9%85%8D&action=edit&redlink=1 "资源的分配（页面不存在）")（获取），同时由[析构函数](https://zh.wikipedia.org/wiki/%E6%9E%90%E6%9E%84%E5%87%BD%E6%95%B0 "析构函数")完成资源的释放。在这种要求下，只要对象能正确地析构，就不会出现[资源泄漏](https://zh.wikipedia.org/wiki/%E8%B5%84%E6%BA%90%E6%B3%84%E6%BC%8F "资源泄漏")问题。

（摘自Wikipedia）

简单来说，资源与对象深度绑定 ——
- 对象创建，资源创建
- 对象销毁，资源释放

简单例子，C++中的`lock_guard`

```C++
std::mutex m;
void foo()
{
// 创建 lock_guard 对象，直接上锁
std::lock_guard<std::mutex> lock(m);
}
// 当函数结束的时候，或者遇到异常退出等情况（离开作用域）
// 执行 lock_guard 的析构函数
// 自动解锁，有效避免了死锁问题
```

## 例子

```C++
class File {
public:
    File(const char* name) {
        f = fopen(name, "r");
    }
    ~File() {
        if (f) fclose(f);
    }
    FILE* get() const { return f; }

private:
    FILE* f;
};

void foo() {
    File file("data.txt"); // 构造 → 打开文件
    // ...
} // 离开作用域 → 析构 → 自动 fclose
```

以上封装了一个符合RAII规范的文件资源，保证了不会因为意外导致文件资源不关闭等

## 智能指针

C++ 中的

- `unique_ptr`
- `shared_ptr`
- `weak_ptr`

最经典的 RAII
其本质就是裸指针+元数据 —— 当只能指针执行析构函数的时候自动释放资源，三者的不同主要为**所有权**

- 唯一所有者 —— `unique_ptr`
- 共享所有者 —— `shared_ptr`
- 非拥有观察者 —— `weak_ptr`

### `unique_ptr`

独占所有权，保证了某个对象在任意时刻只能被一个`unique_ptr`所拥有。
所以不能被拷贝，只能临时调用资源（不移交所有权），或者移动（移交所有权给其他`unique_ptr`）

示例
```C++
#include <memory>

struct Foo {
    Foo() { /* ... */ }
    ~Foo() { /* ... */ }
};

void basic_usage() {
    // 创建：推荐用 make_unique
    auto p1 = std::make_unique<Foo>();

    // 移动所有权
    auto p2 = std::move(p1); // p1 变为空，p2 拥有 Foo

    // 访问
    p2->some_method();
    (*p2).some_method();

	Foo* raw = p2.get();
    // 释放：离开作用域自动 delete
} // p2 析构，Foo 被自动 delete
```

### `shared_ptr`

共享所有权，也就是说一个对象可以同时被多个`shared_ptr`拥有。
在设计的使用，引入了一个计数器，被拥有时候计数器递增，然后再`shared_ptr`释放的时候计数器递减，直到计数器减为 0 的时候自动释放资源。

值得注意——计数器的增减操作是==原子操作==（线程安全），但是对于资源的访问本身==不是==线程安全，需要我们手动规范。

又因为多维护了计数器等东西，所以开销一定会更大。

>[!danger]
> 小心循环引用

如果两个`shared_ptr`相互引用，会产生死锁导致计数器永远不会降到0的情况，导致资源永远不会被释放。

### `weak_ptr`

若所有权，“我有资源，但是所有权不是我的”，即不增加引用计数，只是“看着”一个由`shared_ptr`管理的对象

一般依附于`shared_ptr`产生，不参与生命周期管理




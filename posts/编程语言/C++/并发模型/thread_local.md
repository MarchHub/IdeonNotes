# thread_local

由这个关键字声明的变量, 在每一个线程内都有一个自己独立的实例.

## 简单例子

假设我们声明了 ——

```C++
thread_local int counter = 0;
```

那么假设 thread 1 调用了 100 次 `++counter`, 然后 thread 2 调用了 114 次 `++counter`, 那么实际上它们访问的不是同一个 `counter`, 所以 thread 1 中的 counter = 100, 而 thread 2 中的 counter = 114

## 生命周期和作用域

它的作用域和普通的变量没区别, 但是生命周期是和一整个线程的生命周期一致.

- 从当前线程第一次声明的时候进入生命周期的开始
- 当前线程结束的时候执行释放

先看个例子 ——

```C++
void Foo()
{
    thread_local int count = 0;

    ++count;

    std::cout << count << '\n';
}

int main()
{
    Foo();
    Foo();
    Foo();
}
```

执行出来的结果却是 ——

```
1
2
3
```

说明在 `main thread` 中, 它在反复进入 `Foo()` 的时候, 由于仍处在 `main thread` 所以每次递增的还是原来的对象, 并不会像是 `Foo()` 的局部变量一样在离开 `Foo` 的时候自动销毁

然后我们加入多线程 ——

```C++
thread_local int counter = 0;

void Work()
{
    ++counter;

    std::cout
        << "thread = " << std::this_thread::get_id()
        << ", counter = " << counter
        << '\n';
}

int main()
{
    std::thread t1([] {
        Work();
        Work();
    });

    std::thread t2([] {
        Work();
        Work();
    });

    t1.join();
    t2.join();
}
```

由于实际上存在抢占输出这件事情, 所以不能保证输出一致, 不过在逻辑上可以得到结果 ——

```C++
Thread A counter = 1
Thread A counter = 2

Thread B counter = 1
Thread B counter = 2
```

(同时使用 A/B 来表示那一串 id)

当然, 更狠一点我们如果输出 `counter` 的地址, 会发现地址也不同

## 底层设计

`thread_local` 声明的变量在标准定义中具有 “thread storage duration” 的声明周期, 然后具体实现一般是通过平台提供的 TLS, 所以不是普通堆栈中的变量喵(

## 用途

普通的变量, 我们可能需要考虑数据竞态, 而用一些同步元语去规避这种问题(不然会导致 Undefined Behavior).

而使用这种关键字声明的变量则因为每个线程内的变量都是不同的实例, 所以不需要考虑跨线程访问`thread_local`变量时产生的数据竞态. 可以用于一些不需要共享的数据声明.

我们是否可以把它视作一个 `static` 声明的变量 —— 但是生命周期改成一个线程, 而不是整个程序的生命周期? (直观理解, 不过严谨的说明还是看上文)

那么假设有一个高频函数

```C++
void Foo()
{
	std::vector<char> buffer(1024);
}
```

假设它会在每次调用的时候刷入新的 buffer, 为了避免大量的 allocate 操作带来的开销, 我们在普通的单线程开发中可能会使用

```C++
void Foo()
{
	static std::vector<char> buffer(1024);
}
```

规避了大量的 allocate 操作. 那么同理, 在线程内也可以

```C++
void Foo()
{
	thread_local std::vector<char> buffer(1024);
}
```

当然, `thread_local` 可以当成线程 cache 来使用吧. 来个计数器例子 —— 原先的思路大抵是使用一个总的计数器来进行累加, 使用同步元语保证多线程的环境下结果符合预期

那么现在可以换个思路 —— 各个线程自己先缓存自己产生的结果, 最后做一次聚合即可.

不提供例子了, 自己看 ChikaEngine JobSystem 中的 `thread_local` 用法(

与此同时, `thread_local` 在调用链比较深的时候也比较好用. 比如传递上下文的时候, 假设我们有 `layer1(ctx) -> layer2(ctx) -> layer3(ctx) -> layer4(ctx)`, 那么就可以使用 `thread_local` 进行化简, 是的 layer 1-4 不再需要传递 ctx, 而是直接用这个 `thread_local` 声明的变量即可.
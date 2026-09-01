---
tags:
  - C++
  - 并发编程
  - 异步与调度
---

# Future

Future, 表示这个结果我会在未来进行消费. 那么它具体怎么生产出来玩无所谓. 我持有 `std::future` 只是一个消费者而已.

值得注意的是, 我们并不关注到底是通过协程, 线程, 还是什么神秘方式得到的这个结果, 我只关注在当前执行流中, 我未来会需要消费它而已 —— 即只关心**数据本身**

## 同步执行

```C++
int Calculate()
{
    return 42;
}

int main()
{
    int result = Calculate();
	
	...

    Use(result);
}
```

在同步的执行流中, 在 `Use(result)` 之前, 必须等待 `Calculate` 的执行结束. 那么假设这个方法是一个耗时方法, 那么整个线程就会在那边等待`Calculate`返回结果, 比较坏. 而中间的 `...` 只能干等.

## future

所以我们使用 `std::future` 表示说我们希望可以有一个消费的数据, 当前线程继续执行, 在我们需要这个结果的时候再去取用.

所以它的优点就在于我们把发起和获得结果这两件事情给解偶了.

```C++

int Calculate()
{
    std::this_thread::sleep_for(
        std::chrono::seconds(2));

    return 42;
}

int main()
{
    std::future<int> future =
        std::async(
            std::launch::async,
            Calculate);

    std::cout << "Main continues\n";

    int result = future.get();

    std::cout << result << '\n';
}
```

此处我们使用 `async` 来发起结果的获取, 然后调用 `get()` 进行数据的消费.

此时调用 `get` 可能有两个结果 ——

- 当前 result 已经创建好了, 不阻塞直接用
- 当前 result 还没有被创建好, 阻塞等待它好 (因为接下来操作依赖它, 所以不等不行)

不过, `std::future` 不会自己写好之后要进行消费的数据, 所以就需要一个生产者来加入当前的数据链条(埋钩子🪝ing)

非常值得小心的一点, `std::future` 是**一次性消费** —— 

```C++
auto future =
    std::async(
        std::launch::async,
        [] {
            return 114;
        });

int a = future.get();
int b = future.get();
```

经过一次消费之后, `valid()` 状态也会被设置成 `False`, 那么再次 `.get()` 可能触发 Undefined Behavior

与此同时, 还有一件事 —— future 对象本身是是“独占”所有权的, 也就是说, 无法复制, 只能移动.

```C++
std::future<int> a;
auto b = a;           // ❌
auto b = std::move(a); // ✅
```

好像可以理解成 —— 这个消费只能一次, 且消费权也仅能由一个对象独占

## shared_future

那么对于有多个消费者想要对这个变量进行消费怎么办? —— `std::shared_future`

然后可以多次 `.get()` 了, 不过表示大家都只读一个共享的结果.

## State

我们其实可以通过一个状态机的表现来进行理解 —— 可以看[草案](https://eel.is/c%2B%2Bdraft/futures.state)中的说明, 这个 shared state 包含状态信息, 以及一个可能尚未求值的结果; 结果可以是值或异常

请  GPT 再次展现 ASCII 艺术

```C++
Producer
    │
    │ set value / exception
    ▼
┌─────────────────┐
│   Shared State  │
│                 │
│ ready?          │
│ value/exception │
└────────┬────────┘
         │
         │ read/wait
         ▼
       Future
```

所以实际上来说, 我们的 future 更像是一个 handle, 指向了那个 Shared State. 那么我们借助 `unique_ptr/shared_ptr` 可以类似同理来理解此处的 `future/shared_future`

## 其他

`std::future<T>` 也提供了 `wait` —— 阻塞等待, 但是不进行消费数值, 只有 `get` 才表示对数据进行消费

那么 `wait_for` 也是同样道理, 不再赘述.

不过值得注意 —— `std::future` 也会参与异常的传播

```C++
auto future =
    std::async(
        std::launch::async,
        []() -> int
        {
            throw std::runtime_error(
                "failed");
        });
```

那么在消费端, 我们进行调用 ——

```C++
try
{
    int result = future.get();
}
catch (const std::exception& e)
{
    std::cout << e.what();
}
```

此时就会捕获到 `failed` 这样的 `std::runtime_error`.
## 总结

在使用 `future` (或者相关的东西), 我们最应当考虑的是“我是否要在某时刻消费这个数据”, 而不是关心这个数据是线程/协程或其他什么之类的而得到.

即请关注数据本身, 以及操作/执行流本身!

# Promise

在 Future 的时候说到, 它表示一个消费者 —— 我在未来可能要消费某个数据.

那么 Promise 就是一个与其对应的概念, 表示我在未来要生产出某个数据, 并且写入 `Shared State` 这个共享状态中.

## 最简例子

```C++
int main()
{
    std::promise<int> promise;

    std::future<int> future =
        promise.get_future();

    promise.set_value(42);

    std::cout << future.get() << '\n';
}
```

我们现在直接用 `Shared State` 来进行解释, 其实本质上就是状态的转化 ——

首先我们借助 promise 创建了一个 shared state, 接着定义了一个 future, 说我们之后要消费的值来自于未来 promise 在某时刻生产的 —— 此时将 future 的 shared state 和 promise 进行了绑定, 并且此时还是 `pending` 的状态, 因为我们尚未生产出数据.

然后 promise 调用 `set_value` 表示自己已经生产好了数据, 此时 shared state 就变成了 ready, 并且这个操作把生产好的数值压入 shared state 进行存储.

最后 `future.get` 进行消费.

## 注意

其实可以很好的解释为什么 `set_value` 只能执行一次 —— 因为 promise 仅仅明确是执行一次的生产操作, 假设 `set_value(1)` 和 `set_value(2)` 都被执行, 那么 `future.get()` 应该读到 1 还是 2 呢? 那么加入 get 的时候是夹在两次 set 之间呢? —— 「对的对的, 是1️⃣; 不对不对, 是2️⃣; 对的对的, 不对不对, 对吗对吗……」这样就无法保证结果的一致性. —— 换言之, 共享状态从未完成到完成的状态, 仅被允许一次.

实际我们如果执行了两次 `set_value` 操作会被抛出 `std::future_error` 的错误.

## 异常传播

在 Promise 生产数据的过程中, 如果出现异常, 我们最好主动进行捕获并且放进共享状态中. 然后在消费者调用 `get` 的时候重新把异常抛出来. 而不是跨线程直接到处乱抛 (因为两个独立线程之间的执行实际上并没有调用栈, 而是各自维护自己的调用栈, 所以异常无法沿着调用栈往上传播)

```C++
std::promise<int> promise;
auto future = promise.get_future();

std::thread worker([p = std::move(promise)]() mutable {
    try
    {
        int result = Calculate();

        p.set_value(result);
    }
    catch (...)
    {
        p.set_exception(std::current_exception());
    }
});
```

一个简单例子, 然后消费数据的时候 ——

```C++
try
{
    int result = future.get();
}
catch (const std::exception& e)
{
    std::cout << e.what() << '\n';
}
worker.join();
```

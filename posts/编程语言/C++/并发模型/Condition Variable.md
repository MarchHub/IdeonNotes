# Condition Variable

条件变量, 用于阻塞等待的同步元语.

假设我们有一个线程需要等待某谢耗时操作, 那么一直忙等, 占用资源, 显然不太合适. 此时可以通过阻塞, 然后等待唤醒再继续执行, 比较合适.

那么实际上它的一整套流程包含三个部分 —— 条件变量本身, 锁, 共享状态.

共享状态用于判断当前阻塞的线程是否可以继续, 锁保证在读取和修改共享状态的时候线程安全, CV 负责在条件不满足的时候让线程休眠, 同时在每次唤起线程的时候进行共享状态的检查.

## 简单例子

```C++
std::mutex g_mutex;
std::condition_variable g_cv;

bool g_ready = false;

void Worker()
{
    std::cout << "[Worker] started\n";

    std::unique_lock<std::mutex> lock(g_mutex);

    std::cout << "[Worker] mutex acquired\n";

    g_cv.wait(lock, [] {
        std::cout << "[Worker] checking predicate: ready = "
                  << g_ready << '\n';

        return g_ready;
    });

    std::cout << "[Worker] condition satisfied\n";
}

int main()
{
    std::thread worker(Worker);

    std::this_thread::sleep_for(std::chrono::seconds(2));

    std::cout << "[Main] preparing state\n";

    {
        std::lock_guard<std::mutex> lock(g_mutex);

        g_ready = true;

        std::cout << "[Main] ready = true\n";
    }

    std::cout << "[Main] notify worker\n";

    g_cv.notify_one();

    worker.join();
}
```

输出结果 ——

```
[Worker] started
[Worker] mutex acquired
[Worker] checking predicate: ready = 0
// 此处会暂停 2s
[Main] preparing state
[Main] ready = true
[Main] notify worker
[Worker] checking predicate: ready = 1
[Worker] condition satisfied
```

- 条件变量: `g_cv`
- 共享状态: `g_ready`
- 锁: `g_mutex`

整套逻辑非常简单, worker 线程在执行到 `Wait` 的时候先进行一次 `Lambda` 表达式的执行, 即检查现在是否符合继续执行的条件, 然后在其等待共享状态被设置成 `True` 的时候进入休眠, 在每次其他线程调用 `notify` 的时候会唤醒线程然后进行一次状态检查 —— 即再执行一次 CV 存储的 `Lambda` 表达式. 如果条件为真则继续运行, 否则继续睡眠.

假设我们自始至终都没有一条语句把 `g_ready` 设置成 `true`, 则在 `notify_one()` 的时候条件变量进行检查共享状态还是 false, 不允许 worker 继续执行, 则程序无法正常退出

这点叙述可以通过查看标准库实现得到一些抽象理解 ——

```C++
template <class _Predicate>
void condition_variable::wait(unique_lock<mutex>& __lk, _Predicate __pred) {
	while (!__pred())
		wait(__lk);
}
```

也就是在“语义”上可以这样等价, 不过虽然是 while, 但不是 spin 占用资源蝶苏(

## 锁的逻辑

首先我们有一个需要用锁保护的共享状态, 消费者和生产者都需要访问它, 于是我们规定用一个独占的互斥锁来进行资源的保护.

那么首先消费者执行到 `wait` 的时候, 说明此处消费者已经持有锁了, 那么现在传递一个锁的引用给 CV, CV 要先做一次检查. 检查之后如果需要当前线程需要进入睡眠, 则先归还锁, 然后进入睡眠. 好的, 此处消费者也没有锁了(因为已经归还). 接着兜兜转转, 现在生产者持有了这个锁, 并利用这个锁对共享状态进行了修改, 继续执行,直到调用 `notify` —— 唤醒了消费者线程, 然后消费者继续尝试获取锁(因为 notify 之后可能锁还在生产者身上), 获得锁后从 `wait` 继续执行, 那么 `wait` 再次持有锁, 做共享状态的检查. 如果成功则归还锁给消费者,消费者继续往下执行

## API

大体上的逻辑已经清楚了, 稍微说点 API 上的使用区别.

### wait

普通的 `wait` 就不再赘述.

`wait_for` 在线程最多睡眠一段时间, 这段时间结束后不管谓词真假, 继续往下执行

```C++
bool success =
    cv.wait_for(
        lock,
        std::chrono::seconds(1),
        [&] {
            return ready;
        }
    );

if (success == false)
{
    std::cout << "timeout\n";
}
```

`wait_until` 同上, 只是表示线程休眠到某一个具体的时间戳之后, 不管谓词真假, 继续往下执行

### notify

`notify_one()` 唤醒至多一个正在该 Condition Variable 上等待的线程. 可以表示一些一对一的关系, 比如每次提交了一个任务, 那么也只需要唤醒一个 worker 即可.

`notify_all()` 对应的, 意思是唤醒在该 CV 上等待的所有线程, 不过这可能涉及被唤醒的多个线程之间继续抢占锁的情况. 不过可以用来广播所有的线程状态变化 —— 比如让所有 worker shutdown, 就可以使用


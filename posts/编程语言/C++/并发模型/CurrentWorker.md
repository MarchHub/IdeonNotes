# CurrentWorker

这是一个编外篇, 简单说明清楚一下使用一个 `local_thread` 来记录当前线程的设计.

直接上代码例子

```C++
struct Worker { int id; };

thread_local Worker* currentWorker = nullptr;

void Work()
{
	if (currentWorker != nullptr)
		std::cout << "current worker id = " << currentWorker->id << '\n';
	else
		std::cout << "current worker is null" << '\n';
}

void WorkerMain(Worker* worker)
{
    currentWorker = worker;

    Work();
}

int main()
{
    Worker w0{0};
    Worker w1{1};

    std::thread t0(WorkerMain, &w0);
    std::thread t1(WorkerMain, &w1);

    t0.join();
    t1.join();
    
    WorkerMain(currentWorker);
}
```

我们创建了一个 currentWorker 指针类型, 在每一次 WorkerMain 执行的时候记录当前的 worker 是哪个 worker.

宏观上来看, 我们有 main thread, t0, t1, 三个线程, 所以 currentWorker 应该会有三份实例.

那么在 t0 中, 我们传入了 w0 实例, 所以它的线程上的 currentWorker 被设置成 w0, 那么输出的时候 ID 也就是 0; 同理, 在 t1 中 ID 就是 1. 那么由于 Main 的 currentWorker 在其生命周期内只有初始化 `nullptr`, 所以会触发 `current worker is null`

想要用这样的一个例子来说明 ChikaEngine 中的 JobSystem 中的 `g_Scheduler` 其实不是很恰当. 因为一方面不是一个 Scheduler 多 worker, 另一方面它不是和 worker 和 Scheduler 进行 “绑定”. 比较太化简了

不过之前 `thread_local` 中的多 thread 最后做聚合, 其实倒是和当前这个例子有点像

或许可以在脑子里有一个小建模 —— 就是一个哈希表, 是 current thread -> 对应的 local_thread 变量的映射. 那么每次看到访问这个变量的时候, 要想清楚这是哪个 thread 的变量.
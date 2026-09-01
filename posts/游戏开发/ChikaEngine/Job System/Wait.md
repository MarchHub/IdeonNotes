---
tags:
  - ChikaEngine
  - 并发编程
  - 异步与调度
---

# Wait

假设一个线程调用了 `Wait()` 方法, 那么首先它确乎是会阻止代码继续往下运行, 而是等待任务执行完毕.

那么卡在这个等待的时间, 我们要如何继续利用这个线程呢? ——

首先我们利用了

```C++
while (!IsComplete(handle)) {
	...
}

slot->condition.wait(...)
```

两种操作保证发起 `Wait()` 的线程逻辑正确(不会继续往下运行)

那么朴素的, 假设 `while` 语句里面我们直接进行 `sleep`; 或者仅写 `condition.wait` 的话, 那就是非常传统的阻塞了 —— 当前线程挂起, 不占用 CPU, 等待唤醒.

不过此时我们判断了一下是否 `CanHelp` —— 也就是当前如果存在可以运行的 Job, 则先不要切换上下文, 不要交出 CPU 等资源, 趁着在等待自己发起 `Wait` 的这个 Job 还没完成的时候, 继续干点活.

那么允许参与 `Help` 的线程只有 main thread 以及**当前**(发起 Wait 的线程)中 JobSystem 中的 Workers —— 我们可以假设没有 help 机制, 全部睡眠或者阻塞.

那么有一种极端情况 —— Worker 0 等待一个 Worker 1 的任务, 于是 Worker 0 阻塞; Worker 1 等待 Worker 2 的任务, 于是 Worker 1 阻塞 ...... 直到最后所有 Worker 全部阻塞, 没有人继续干活(. 或者不形成环, 单纯是 Worker 0 等待 Worker 1; Worker 1 等待 Worker 0 而形成的死锁也有可能发生. ( 不是说可以解决逻辑死锁, 而是说可以解决饥饿死锁 —— 明明有处于 ready 的任务, 但是依旧所有线程挂起而不是恢复去执行)

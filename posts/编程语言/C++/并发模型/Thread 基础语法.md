# Thread 基础语法

简述 C++ 中的并发，聚焦在`std::thread` （不得不说，还得是你 golang

## 创建线程

`std::thread worker(task);`

创建一个用于管理线程的对象，同时新开一个线程执行`task`中的内容

这个管理对象类似于该线程的owner，拥有所有权，不可以被复制，但是可以转移。不过关于线程的调度问题不是它管的

值得注意，当执行这个语句之后，当前线程不会自动阻塞等待task执行完毕，而是继续往后执行。

如果需要等待线程执行结束的话，需要使用`worker.join()`来等待`worker`所管理的线程执行结束

```C++
std::thread worker(task);
worker.join();
... // 到这里时，task 已经执行完成
```

## `join`

个人理解上，它的语义是让子线程（工作线程）*同步*到父线程（调起线程）上 ——

- 如果子线程没有执行完毕，则父线程阻塞在`join();`语句直到执行结束
- 执行结束之后可以保证数据同步

所以此时 `joinable()` 就比较好理解 ——

- `false`
	- 当前的线程已经执行完工作了，并且已经保证数据同步（执行过`join` / `detach`
	- 当前线程本身就无效（比如默认无参构造
- `true`
	- 当前线程还没有执行过 `join` 等，不能保证数据同步

## `detach`

表示让线程脱离当前 `std::thread` 对象独立运行 ——

也就是 task 确乎是在子线程运作，但是不再受到 thread 的生命周期管理

```C++
void run() {
	int value = 10;
	std::thread worker([&value] { value = 20; });
	worker.detach();
}
```

比如此时哪怕 `run` 已经返回了，但是 `worker` 中的闭包依旧会访问 `value` 导致错误（因为已经释放了）

## id

获取**当前正在执行代码的线程**的 ID ——

```
std::thread::id id = std::this_thread::get_id();
```

如果这行代码运行在主线程中，得到主线程 ID。
如果它运行在工作线程中，得到工作线程 ID。

要获取某个 `std::thread` 对象所管理线程的 ID，则 ——

```
std::thread worker(task);
std::thread::id id = worker.get_id();
```

## 生命周期

主要分成三个维度来看 ——

- 父线程
- 子线程
- thread 对象

首先最好明白的是 thread 对象，它就是一个普通的管理类对象，所以生命周期就是由普通 C++ 作用域决定。不过当其触发析构的时候，如果发现`joinable() == true`则会触发`terminate`

父线程也是顺序执行下去，如果遇到`join`则阻塞等待子线程结束

## jthread

`std::jthread` 是 C++20 引入的线程类，增加了俩功能 ——

- 析构时自动等待线程；
- 提供 `stop_source / stop_token` 协作停止机制。

### stop_token / request_stop

用于协助线程停止，例子 ——

```C++
std::jthread thread(
    [](std::stop_token stop_token)
    {
        while (!stop_token.stop_requested())
        {
            do_some_work();
        }
    });
```

（ task 函数不接受 stop_token 也是完全合法的）

然后控制线程的话，就可以通过`thread.request_stop();`使得有检查`stop_requested()`的方法退出，不过值得注意的是，`request_stop()`不是强制线程退出，只是发出停止请求而已，任务必须通过轮询 `stop_requested()`、可停止等待或 `stop_callback` 等方式观察该请求，否则它不会因为停止请求而自动退出；与此同时，在之后仍旧需要手动执行 `.join()` 以等待线程函数完整结束，并回收线程执行资源。

### 析构

在 `std::thread` 中，析构函数的逻辑是 —— 如果 `thread` 仍然是 `joinable()`，则执行`std::terminate()`

但是在`jthread`中，会在析构的时候自动`join`（但是不保证不会一直阻塞在这里），逻辑上等价于 ——

```C++
{
    std::jthread thread(task);

    // 作用域结束时由析构函数完成：
    if (thread.joinable())
    {
        thread.request_stop();
        thread.join();
    }
}
```

### 移动

同理的，在移动赋值的时候

```C++
std::thread first(task1);
std::thread second(task2);

first = std::move(second);
```

如果 `first` 仍然是 `joinable`，则会调用 `std::terminate()`

但是如果二者都是 `jthread` 的话，`first` 会先 `request_stop()` 然后 `join`，最后再移动


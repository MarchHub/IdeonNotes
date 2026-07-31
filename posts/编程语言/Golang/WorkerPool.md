---
title: WorkerPool
tags:
  - Go
  - 并发编程
  - 异步与调度
date: 2025-08-09
---
# WorkerPool

工作池，一种并发设计，其中有两个主要概念
- 工人：干工作的工人
- 工作：分配的任务

## 简单实现

```go
type Job struct {
    Id   int
    Data string
}

func Worker(id int, tasks chan Job, wg *sync.WaitGroup) {
    defer wg.Done()
    for t := range tasks {
        fmt.Printf("Worker %d processing task %d, and data %s\n", id, t.Id, t.Data)
        time.Sleep(time.Millisecond * 50)
    }
}

func main() {
    const POOLSIZE = 5
    tasks := make(chan Job, 10)
    var wg sync.WaitGroup

    for i := 1; i <= POOLSIZE; i++ {
        wg.Add(1)
        go Worker(i, tasks, &wg)
    }
    
    for i := 1; i <= 50; i++ {
        tasks <- Job{
            Id:   i,
            Data: fmt.Sprintf("payload-%d", i),
        }
    }
    
    close(tasks)
    wg.Wait()
    fmt.Println("all tasks done")
}
```

首先`Job`结构体定义了任务所需要的数据；
`Worker`函数定义了“工人”具体的操作行为，然后创建了一个`WaitGroup`来存放所有的工人，这样可以保证在所有的并发任务执行完成之后再进行下一步操作；

执行逻辑：
1. 在主线程中，我们创建了工作池，并且有五个执行任务的“工人”
2. 利用通道无数据的阻塞，使得他们在等待通道传输任务
3. 在主线程中我们通过创建`Job`并且写入任务通道。
4. 任务通道有了任务，工作池中开始正常工作

## 注意点

### 遍历通道

`for t := range tasks` 会一直读取通道`tasks`中的内容，因为它的本质也是`t := <- tasks`，所以阻塞情况和普通的从通道中读取数据没差别。
但是，当遍历一个有缓已关闭的通道，会==接收通道内所有的缓存数据==，然后返回。

### WaitGroup

如果不先关闭通道，直接`wg.Wait()`会因为`for t := range tasks`一直阻塞而造成死锁💦

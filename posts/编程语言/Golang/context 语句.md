---
title: context 语句
tags:
  - Go
  - 并发编程
  - 异步与调度
date: 2025-08-11
---
# context 语句

Context（上下文），可以理解为一种协调 Go 协程的东西 —— 我们可以创建、运行一个 Go 协程，缺乏一种传递取消信号和截止时间的机制，便引入了 Context。

它主要针对以下三种情况：
- 跨 goroutine 的取消信号与超时管理
- 请求级别的元数据（如 traceID、用户认证信息）传递
- 避免全局变量和隐式状态，保持函数签名清晰

假设有一个非常长的调用链，但是上游已经取消或超时了，正常情况下，如果没有传递取消信号并主动停止，Go 协程会依旧把接下来的调用链给执行掉，然而这样非常浪费资源，以及可能会有其他问题（比如用户意外退出，但是数据库操作等没有停止之类的）

将 `Context` 理解成一个带着特殊信息（取消/超时信号、截止时间、键值对等）的只读接口，在各种调用链之类的中，可以将 `Context` 传入，并且**显式地监听这些属性**，并且做出对应的操作，就是 `Context`

## 使用

使用一个 `Context` 作为根节点，然后使用 `context` 包下的一些函数来“派生”它，最后使用。（~~其实最开始看到根节点还有点蒙到底是什么~~）

### 根节点

1. `context.Background()`：返回一个空的、永不取消、无超时、无值的 Context
2. `context.TODO()`：返回一个空的 Context，但语义上表示“还不确定用哪种 Context”

但是看源码定义：
```go
type todoCtx struct{ emptyCtx }
type backgroundCtx struct{ emptyCtx }
```

在数据的结构上它们其实是一致的，只是表达的语义（阅读理解）上不一样。
- `Background` 明确表示“顶层、永不取消”
- `TODO` 明确表示“待定、临时占位”

### 派生

“派生”，其实就是在父 `Context` 的基础上获得一个子 `Context`。

1. `context.WithCancel`：提供一个 `cancel` 函数，可以手动发送取消信号
2. `context.WithDeadline`：在指定的截止时间到达时自动取消子 Context
3. `context.WithTimeout`：简化版的 `WithDeadline` —— 等价于 `WithDeadline(parent, time.Now().Add(timeout))`
4. `context.WithValue`：可以传递一个请求范围的键值对，

观察源码，可以发现，就是一个工厂方法来负责从父 Context 派生，给调用链提供取消信号、超时控制或键值传递（就是对应不同使用场景下的 `Context`）

实际例子：
```go
func worker(ctx context.Context, done chan<- struct{}) {
    defer close(done)
    fmt.Printf("Start Working\n")
    for {
        select {
        case <-ctx.Done():
            fmt.Println("上下文发送退出信号, 退出, Err:", ctx.Err())
            return
        default:
            fmt.Printf("Working...\n")
            time.Sleep(300 * time.Millisecond)
        }
    }
}

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    done := make(chan struct{})
    go worker(ctx, done)
    time.Sleep(3 * time.Second)
    cancel()
    <-done
    fmt.Println("Main 结束")
}
```

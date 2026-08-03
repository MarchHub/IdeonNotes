---
tags:
  - Go
  - 资源管理
---

# defer 关键字

`defer` 英文释义为“延迟”，有点意思，使用 `defer` 注册一个函数调用，使其在**包含它的函数即将返回**时执行

```go
func DeferTest() {
    fmt.Println("Defer 执行")
}
func Worker() int {
    fmt.Println("Do something 01")
    defer DeferTest()
    fmt.Println("Do something 02")
    return -1
}
func main() {
    fmt.Println("函数执行完毕, 返回值为", Worker())
}
```

执行结果 ——
```text
Do something 01
Do something 02
Defer 执行
函数执行完毕, 返回值为 -1
```

我们在 `Worker` 中使用 `defer` 注册了 `DeferTest` 的函数调用，执行流到达 `defer` 后，它会在 `return` 前再执行

## 注意

其中，如果我们使用 `defer` 注册了多个函数，那么会按照 **LIFO**（后进先出）的顺序调用；函数值与参数在执行到 `defer` 时求值，函数调用则被延迟。

## 底层原理

每次执行 `defer` 语句时，函数值和参数都会立即求值并保存，但实际调用会延迟到外围函数返回或发生 panic 展开时，并按照注册顺序的逆序执行。

## 常用

- **锁管理**：在获取锁后立即 `defer mu.Unlock()`，确保函数任何返回路径都能释放锁。
- **连接与文件关闭**：`defer conn.Close()`、`defer file.Close()` 保证资源释放，避免泄漏。
- **取消 Context**：`ctx, cancel := context.WithCancel(parent)` 后用 `defer cancel()` 释放相关资源。

有时候由发送方在退出时使用 `defer close(ch)` 关闭通道也是一种不错的方法

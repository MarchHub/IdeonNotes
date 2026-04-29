# defer 关键字

`defer` 英文释义为“延迟”，有点意思，使用`defer`注册一个函数调用，使其在**包含它的函数**==即将返回==时执行

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

我们在`Worker`中使用`defer`注册了`DeferTest`的函数调用，不管注册的位置在哪，它都是在`return`前再执行

## 注意

其中，如果我们使用`defer`注册了多个函数，那么都会被压入栈内，从而实现**FISO**（先进后出）的调用顺序。

## 底层原理

Go 运行时为每个活跃的 goroutine 维护一个 defer 栈。编译器在每个包含 `defer` 的函数入口处初始化这个栈，遇到 `defer` 时将对应信息推入。函数返回时，会跳转到一个专门的清理逻辑，遍历执行所有 defer 调用。

## 常用

- **锁管理**：在获取锁后立即 `defer mu.Unlock()`，确保函数任何返回路径都能释放锁。
- **连接与文件关闭**：`defer conn.Close()`、`defer file.Close()` 保证资源释放，避免泄漏。
- **取消 Context**：`ctx, cancel := context.WithCancel()` 后用 `defer cancel()` 避免 goroutine 泄漏。

有时候通道的释放`close`用`defer`修饰也是一种不错的方法
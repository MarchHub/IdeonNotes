---
title: WaitGroup
tags:
  - Go
  - 并发编程
  - 同步机制
date: 2025-08-09
---
# WaitGroup

本质上是用于等待一组任务完成的计数同步原语

## 基本操作

- `Add` 增加任务计数，计数从 0 增加时必须发生在对应的 `Wait` 之前
- `Done` 标记一个任务完成，将任务计数减 1
- `Wait` 阻塞当前 Go 协程，直到任务计数等于 0 时继续执行；如果计数变成负数，程序会 panic

## 注意

```go
type WaitGroup struct {
	noCopy noCopy
	state atomic.Uint64
	sema uint32
}
```
可以看到，关于任务计数的递增或者递减是**原子操作**，且不允许 `WaitGroup` 在首次使用后进行复制操作 —— 因为复制之后会导致计数器不准确

所以在传递 `WaitGroup` 的时候，应该传递指针类型，指向我们需要的 `WaitGroup`；如果复用同一个 `WaitGroup`，新一批 `Add` 必须发生在上一批 `Wait` 返回之后

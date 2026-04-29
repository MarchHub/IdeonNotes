---
title: WaitGroup
tags: []
date: 2025-08-09
---
# WaitGroup

本质上应该是信号量

## 基本操作

- `Add`添加任务
- `Done`标记一个任务的完成
- `Wait`阻塞当前Go协程，直到信号量大等于0的时候继续执行

## 注意

```go
type WaitGroup struct {
	noCopy noCopy
	state atomic.Uint64
	sema uint32
}
```
可以看到，关于信号量的递增或者递减是==原子操作==，且不允许`WaitGroup`进行复制的操作 —— 因为复制之后会导致计数器不准确

所以在传递`WaitGroup`的时候，只能传递指针类型，指向我们需要的`WaitGroup`
---
title: map
tags:
  - Go
  - 类型系统
date: 2025-08-13
---
# map

哈希表，平均 `O(1)` 查询，在 Golang 中值得注意 —— **未同步的并发读写不安全**

## 底层原理

不是基于红黑树的实现；从 Go 1.24 开始，内置 map 使用基于 Swiss Table 的哈希表实现——

每个 group 包含 8 个键值槽位和一个 8 字节的 control word，用来快速比较哈希值的部分位，减少对比完整 key 的次数。

如果发生哈希冲突，会通过开放寻址在后续 group 中探测可用槽位，而不是指向旧实现中的 `overflow bucket`。

如果 table 增长到容量上限，会通过替换或拆分 table 完成扩容

## 基础使用

```go
table := make(map[string]int)
table["Tom"] = 114

val, ok := table["Jack"]
fmt.Println(val, ok)

delete(table, "Tom")

for k, v := range table {
    fmt.Println(k, v)
}
```

遍历的时候，`k-v` 的顺序未指定，也不保证与前一次遍历相同

---
title: map
tags: []
date: 2025-08-13
---
# map

哈希表，`O(1)`查询，在`golang`中值得注意 ——==非并发安全==

## 底层原理

不是基于红黑树的实现，而是使用哈希函数和桶的结合——

每个`bucket`存储最多 8 组键值对，它内部还有一个 8 字节的`tophash`数组，用来快速比较哈希值的高位，减少对比完整 key 的次数。

如果存入的数据多余 8 条，就指向`overflow *bucket`（溢出操作）

如果某个`bucket`比较肥，或者`count`比较大时，会触发扩容

## 基础使用

```go
table := make(map[string]int)
table["Tom"] = 114

val, ok := table["Jack"]
val := table["Jack"]

delete(table, "Tom")

for k, v := range table {
  fmt.Println(k, v)
}
```

遍历的时候，`k-v`在每次运行时会随机变化


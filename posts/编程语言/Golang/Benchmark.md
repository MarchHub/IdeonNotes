# Benchmark

基准测试，其文件命名与存放和测试文件一致。

## 基础使用

```golang
// calc_test.go
package example

import "testing"

func BenchmarkAdd(b *testing.B) {
  for i := 0; i < b.N; i++ {
    _ = Add(1, 2)
  }
}
```

`b.N` 是框架自动决定的循环次数，非常高级

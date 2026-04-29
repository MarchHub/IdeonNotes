# Test

Golang 单元测试的书写 ——

## 书写规范

1. 测试文件统一以 \_test.go 结尾，放在与被测代码同一目录下；
2. 测试包可以是和被测代码同包，也可以写成 package foo_test 实现黑盒测试；
3. 每个测试函数必须以 Test 或 Benchmark 开头，后跟大写字母标识被测单元。

## 基础语法

```golang
// A_test.go
package example
import "testing"

func TestA(t *testing.T) {
    // wanted 表示预期输出
    got, err := A(inputs)
    if err != nil {
        t.Fatalf("")        // 格式化报告并终止
    }
    if got != wanted {
        t.Errorf("……")      // 输出错误日志
    }
}
```

- `Error` 输出错误日志，但会继续往后执行
- `FailNow` 和 `Fatalf` 输出错误日志后标记测试失败后直接终止测试

## 并行和子任务测试


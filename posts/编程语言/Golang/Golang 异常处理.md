---
title: 异常处理
tags: []
date: 2025-08-14
---
# 异常处理

## Error

函数显式返回`error`
- 如果有错误就返回错误
- 如果没有错误就返回`nil`

源码中对于`Error`的定义 ——
```go
type error interface { Error() string }
```

提供一个基础的使用例子：（和 `rust`中的例子一样，减法运算中的大数减小数字）
```go
func Subtraction(a int, b int) (int, error) {
    if a < b {
        return -1, errors.New("a is lower than b")
    }
    return a - b, nil

}
func main() {
    a := 1
    b := 5
    res, err := Subtraction(a, b)
    if err != nil {
        fmt.Println(err.Error())
        return
    }
    fmt.Println(res)
}
```

`Error`有两种定义方式
- `errors.New("一个字符串描述问题")`
- `fmt.Errorf("可以格式化的字符串 %d %s", d, s)`

对于一些常见的错误，可以体现定义好，之后做比较或者`switch`分类处理也可

## Panic 和 Recover

`panic` 遇到异常是直接退出程序，`recover`是用于捕获`panic`的异常之后使程序重新从`panic`退出的位置继续执行 —— 所以需要使用`defer`来使得`recover`的方法依旧可以执行

```go
func PanicTest(a int) {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("已 Panic, 但是继续执行")
        }
    }()
    panic("Panic Shoot!")
    // 此函数直接退出不执行
    fmt.Println(a)
}
func main() {
    a := 1
    PanicTest(a)
    // 但是主函数不受影响继续执行
    fmt.Println(a)
}
```
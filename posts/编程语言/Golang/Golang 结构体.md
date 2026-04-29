---
title: Golang 结构体
tags: 
date: 2025-08-10
---
# Golang 结构体

Golang 推荐组合而不是继承。

## 基础使用

首先，声明一个结构体：
```go
type Person struct {
    Field1 Type1
    Field2 Type2
    ...
}
```

特别的，`_Name`（以下划线开头）和`name`（首字母小写）的字段，属于私有变量，无法直接通过`.`访问符访问

接着，声明一些方法：
```go
func (p Person) LogName() {
    fmt.Println(p.Name)
}

func (p *Person) ModifyName(newName string) {
    p.Name = newName
}
```
其语法为：`func (接收者) 方法名 (参数) 返回值 { 方法体 }`
也就是比普通的函数多了一个接收者而已，其中指针类型是可以进行访问和修改的类型，普通的类型应该就是值传递（~~废话~~）

## 嵌套结构体

因为没有继承，所以就组合一下（嵌套），但是不建议嵌套太深，不如直接上接口

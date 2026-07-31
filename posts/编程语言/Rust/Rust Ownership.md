---
tags:
  - Rust
  - 内存管理
---

# Ownership

在 Rust 中，所有权（ownership）属于每一个“值”（value），也就是用 `let`、函数参数或结构体字段创建的任何变量或数据结构。无论是基本数值类型（如 `i32`、`bool`）、堆分配的集合类型（如 `String`、`Vec<T>`）、用户自定义的 `struct` 和 `enum`，还是智能指针类型（如 `Box<T>`、`Rc<T>`、`Arc<T>`），它们都各自“拥有”自己的数据，并在超出作用域时负责释放这些数据。

# 堆和栈

## 堆

通常不连续，受物理内存的限制，空间比较大，一般分配大型数据或者动态数据
**离开作用域之后直接回收**

## 栈

通常连续，空间有限（溢栈错误常见），一般分配中小型数据。存储的所有数据都必须占用==已知==的==固定大小==的内存空间

# 所有权 Ownership

Rust 通过所有权系统来管理内存

>1. Rust 中每一个值都被一个变量所拥有，该变量被称为值的所有者
>2. 一个值同时只能被一个变量所拥有，或者说一个值只能拥有一个所有者
>3. 当所有者（变量）离开作用域范围时，这个值将被丢弃(drop)
> —— Rust Course

## Case 1 栈区

一般针对基本类型

```rust
let x: i32 = 5;
let y: i32 = x;
println!("x = {}, y = {}", x, y);
// 输出不一样的地址
println!("*x = {:p}, *y = {:p}", &x, &y);
```
 
   直接在栈区复制, 相当于对该引用进行了拷贝, ( 从栈区开辟了一个新的内存存储 y ) 所以 x 对 5 的所有权不会消失 访问 x 不会有问题

## Case 2 堆区

一般对于需要动态分配的数据或者大型数据而言

```rust
let s = String::from("Hello Rust");
let s1 = s;
println!("s = {}", s); // Error!
```

==错误代码==

分析 ——
1.  "Hello Rust“ 在堆区开辟，s 拥有其所有权
2. s1 是对于 s 的拷贝，类似于浅拷贝，s1 现在指向 "Hello Rust", 导致 s 没有指向一个明确的内存空间，于是被回收（drop）无法访问
3. 再次访问 s 报错

## Case 3 函数

### 传递所有权

```rust
fn take_ownership_int(s: i32) {
	// s 不会被回收，所有权还是给调用此函数的那个变量
}
fn take_ownership_string(s: String) {
	// s 会被回收，
}
```

对于传递基本类型来说，会标记 no drop 不回收，也就是在执行完函数之后所有权还是会还给传给这个函数的变量。
比如 ——
```rust
let x: i32 = 11;
take_ownership_int(x)
```
此时所有权还是 x 的

但是对于复杂类型来说，把变量传递给此函数的时候，已经把所有权移交给函数了，而在函数执行完成之后，参数会被回收。比如 ——

```rust
let s = String::from("Hello rust");
take_ownership_string(s);
println!("{}", s);
```

==错误代码==

分析 ——
1. s 拥有 "Hello rust" 的所有权
2. s 的所有权移交给了 `take_ownership_string` 函数
3. `take_ownership_string` 函数执行完成，并没有归还 s 的所有权给 s，而是回收（因为开辟在堆区）
4. 导致 s 无法再被访问

也可以还回去
```rust
fn giveback_ownership(s: String) -> String {
	println!("{}", s);
	s
}
```

## 借用

> [!note] 不移交变量的所有权，而是给出变量的引用

用于解决反复对于所有权移交的复杂，提出借用的概念。（有点类似 C 中的引用传递）


```rust
fn borrow_test(s: &String) {
	// 可以读取 s 的数值, 并且不会影响传参的所有权
}
```
这里的 `s` 就是对传入参数的借用 （引用），但是是不可变引用
可以有如下用法

```rust
let s = String::from("Hello rust");
borrow_test(&s);
println!("{}", s);
```

在 `borrow_test` 中只传递了 `s` 的不可变引用, 所以不影响 `s` 的所有权, `s` 依旧可以访问

如果想要传入可变引用的话 ——
```rust
fn mut_borrow_test(s: mut &String) {
	// 可以对 s 进行修改
}
```

此处不影响传参的所有权，但是可以在函数中修改变量

>[!note]
>1. 不可变引用可以有多个
>2. 可变引用只能有一个

# 引用和借用的关系

借用（Borrowing）是指“临时借用”一个值而不转移所有权，通过引用来访问数据。

可以说借用是达成不移交所有权而访问数据的**目的**，而引用是实现借用的**手段**？
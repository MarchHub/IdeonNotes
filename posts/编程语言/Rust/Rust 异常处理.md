# Rust 异常处理

## Panic

> Panic Shot! —— Onikata Kayoko

rust 提供了一个`panic!`的宏 —— 当程序执行到这个宏的时候，会打印出错信息后，展开报错点往前的函数调用堆栈，最后**退出程序** —— 其实是退出该线程，所以如果在 main 中遇到 panic，就会直接退出 main 线程导致程序意外终止。所以还是要小心使用 panic。

也就是说，使用 panic 处理的错误应当是直接影响到程序正常运行的错误，即**不可恢复错误**。

## Result 和 Option

既然与 Panic 同一层级，说明这个类型可以用于处理**可恢复错误**

### 基础使用

首先说下 Result，它的本质是枚举型
```rust
enum Result<T, E> {
	Ok(T),
	Err(E),
}
```
如果是程序正确执行，就返回一个`Ok(T)`的泛型数据；如果程序出现异常，就返回`Err(E)`的泛型数据

其中`T`可以看作正常程序的返回值；`E`则存放了错误信息；
接下来回到小学还没学过负数的时候，我们眼中只知道使用大的数减去小的数，否则就觉得这是个错误的算式，就可以得到如下代码 ——
```rust
fn sub_without_negative(x: i32, y: i32) -> Result<i32, String> {
    if x < y {
        Err(String::from("x is lower than y"))
    } else {
        Ok(x - y)
    }
}
```
然后在使用的时候，就可以使用模式匹配去处理对应的错误，比如
```rust
    let res =  match sub_without_negative(x, y) {
        Ok(r) => r,
        Err(msg) => {
            panic!("Encounter an error —— {:?}", msg)
        }
    };
```
那么为什么这里使用`panic!`宏呢？因为小时候遇到这种情况的时候大脑宕机了，开始怀疑人生，于是直接退出当前线程~~（不去多想）~~
当然，由于我们使用 match 捕捉到了 Err 的情况，就可以对此进行一些处理，使得程序至少可以正常运行下去，而不是使用`panic!`宏来处理。

### 执意使用 panic

对的兄弟，对的。当然可以用一些化简的写法来在匹配到 Err 后使用 panic。

1. `unwarp()` —— 没有额外的提示信息，直接给 panic 出线程
2. `except()` —— 可以带上一点错误打印信息

### 错误传播

基本上生产实践中不可能只有一层的函数调用，大概率都是一层套一层的，非常麻烦。于是我们需要一种把错误从调用链的下层往上游传播的手段。

首先自然想到的，就是把调用层遇到的 Error 重新包一个`Err(E)`传给调用链上层—— 
（这里使用的[《Rust 圣经的例子》](https://course.rs/basic/result-error/result.html)) ~~因为懒~~，非常的好
```rust
use std::fs::File;
use std::io::{self, Read};

fn read_username_from_file() -> Result<String, io::Error> {
    // 打开文件，f是`Result<文件句柄,io::Error>`
    let f = File::open("hello.txt");

    let mut f = match f {
        // 打开文件成功，将file句柄赋值给f
        Ok(file) => file,
        // 打开文件失败，将错误返回(向上传播)
        Err(e) => return Err(e),
    };
    // 创建动态字符串s
    let mut s = String::new();
    // 从f文件句柄读取数据并写入s中
    match f.read_to_string(&mut s) {
        // 读取成功，返回Ok封装的字符串
        Ok(_) => Ok(s),
        // 将错误向上传播
        Err(e) => Err(e),
    }
}
```

但是这样写非常的繁琐，于是简单的使用一个`?`来简化这些代码 （例子代码还是来自《Rust 圣经》非常好的一本书！
```rust
use std::fs::File;
use std::io;
use std::io::Read;

fn read_username_from_file() -> Result<String, io::Error> {
    let mut f = File::open("hello.txt")?;
    let mut s = String::new();
    f.read_to_string(&mut s)?;
    Ok(s)
}
```

`?`的本质就是一个宏，把繁琐的 match 打包了一下而已。

特性：`?`支持链式调用
```rust
foo_outer()?.foo_inner()?.foo_inner_inner()?; // 开个玩笑

File::open(DATA_PATH)?.read_to_string(&mut file_data)?
```


### Option

最后谈到 option，它有点像**一个可能为空的值**（比如在C#中使用?表示一下改属性可能为空，有点类似）
不过谈及根本，其实更像是 Result 的一个**特例**
```rust
pub enum Option<T> {
    Some(T),
    None
}
```
也是一个枚举型，其中如果正常执行，就返回`Some(T)`，如果出现异常，就返回`None`
有点像我们定义了一个`Result<Some(T), ()>`

遇到错误简单的返回一个空，想到的运用场景 ——
- 错误比较简单，一眼顶真
- 不太可能出现错误
- 简单的搭建一下原型，因为写 Result 太复杂

另外的，`Option`也支持使用`?`进行链式调用

## 写在最后

进行一个非常非常简略的小总结——
- 恶劣到影响程序运行的错误，可以使用`panic!`
- 基本上使用 `Result` 偏多
- 简单情况可以使用 `Option`

当然，实际上还会更复杂一点（未来可期）
- 错误类型转化
- 嵌套错误的匹配处理；组合器 —— `or, then`之类的
- 自定义错误
- 等

特别的，`main` 函数也可以带有异常处理的返回值，比如
```rust
fn main() -> Result<(), Err(E)>
```
其中 `Err(E)` 就自行填入需要的类型罢！
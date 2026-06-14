# Type Traits

在编译器对类型进行“玩弄”（查询，判断，转化）的工具

理解为把数据类型作为输入的一个映射

一个常见的类型分发的例子 ——

```C++
template <typename T>
void Foo(T value)
{
    if constexpr (std::is_enum_v<T>)
    {
        // 根据类型分支
    }
}
```

## 常见输出

### 数值

在库里，`_v`一般表示输出编译期常量（value / bool），比如

```C++
std::is_enum_v<T>
std::is_integral_v<T>
std::is_same_v<A, B>
```

即为在编译期输出一个 bool 判断

```C++
std::is_enum_v<int>        // false
std::is_integral_v<int>    // true
std::is_same_v<int, int>   // true
std::is_same_v<int, float> // false
```

比如 `is_enum_v` 可以等价于 `std::is_enum<T>::value` 就是取出 value，

我们利用这个方法知道了类型之后，常用于

- 序列化
- 内存拷贝优化
- 容器实现
- 二进制文件读写
- 等

### 类型

`_t` 一般就表示输出一个类型 ——

```C++
std::remove_reference_t<int&>        // int
std::remove_const_t<const int>       // int
std::underlying_type_t<MyEnum>       // enum 的底层整数类型
std::conditional_t<true, int, float> // int
```

那么类似的，它也可以等价于`typename std::remove_reference<T>::type` 就是取出 `type`

实际上这也是一个别名，alias template，等价于 `typename xxx<T>::type`

常见可以用来获取干净类型，比如`remove_cvref_t`去除去 const / volatile / reference

此处就非常适合用 using 语句给返回的类型起别名（


## 原理

实际上是类模板与模板特化

## 运用

蛮多

提供一些 wrapper 作为例子罢

```C++
// 把类型包装成值
template<typename T>
struct TypeTag
{
	using Type = T;
};

// 具体使用
template <typename T>  
std::unique_ptr<T> Create(TypeTag<T>)  
{  
return std::make_unique<T>();  
}
```

这样就可以不再写`Create<int>()`而是可以写成`Create(TypeTag<int>{});`，多新鲜呐（

在业务代码里直接把数据类型作为函数参数传递，这样类型可以像是普通的函数参数一样传递、重载、转发
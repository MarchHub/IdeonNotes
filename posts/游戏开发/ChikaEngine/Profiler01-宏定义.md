# Profiler01-宏定义

拆分`Profiler`中的宏定义和展开这块的内容 ——

## 开启 / 关闭 Profiler 模块

Profiler 提供了两层开关：  
  
- 编译期开关：决定埋点代码是否被编译进目标文件  
- 运行时开关：决定 ProfilerSession 当前是否采集事件

### 编译期

首先在顶层的`cmake`中定义了选项

```cmake
option(
	CHIKA_ENABLE_PROFILING
    "Compile ChikaProfiler instrumentation into engine targets"
    ON
)
```

接着通过

```cmake
add_compile_definitions(CHIKA_ENABLE_PROFILING=$<BOOL:${CHIKA_ENABLE_PROFILING}>)
```

将其转化成宏，然后在`ProfilerMacros`中根据宏定义选择行为

### 运行时

通过设置在初始化 `Profiler` 的时候传入的 `enabled` 参数进行设定 或者运行时进行 `SetEnabled` —— 如果不启用，则在运行时不采集事件 —— 它仍会执行宏展开后的代码入口，但是运行时会因为没启用而“早退”

## 宏定义

主要可以阅读源码`ProfilerMacros.hpp`

先在开头兜底 ——

```C++
#ifndef CHIKA_ENABLE_PROFILING
#define CHIKA_ENABLE_PROFILING 0
#endif
```

如果构建系统没有定义 CHIKA_ENABLE_PROFILING，那就默认认为它是 0

接着是做了一个 token 拼接

```C++
#define CHIKA_PROFILE_CONCAT_IMPL(lhs, rhs) lhs##rhs
#define CHIKA_PROFILE_CONCAT(lhs, rhs) CHIKA_PROFILE_CONCAT_IMPL(lhs, rhs)
```

此处使用两层宏包裹 —— `##` 两侧的参数在拼接前不会按普通方式继续展开。cppreference 对扫描与替换规则也说明：宏参数在进入 replacement-list 前会被扫描，但 `#` 和 `##` 是例外，它们处理的是未先宏展开的参数

所以实际上是让外层先把`__LINE__`等先进行展开，然后再在内层进行拼接

### 启用时

正常的定义了`CHIKA_PROFILE_SCOPE`等东西，里面涉及到的模块具体做了什么会在之后说明

此处使用了`__LINE__`做一个拼接，这样大概率在一个作用域内定义变量的时候不会重复（除非有压行的疯子在同一行定义多个`CHIKA_PROFILE_SCOPE`

### 关闭时

使用`((void)0)`，避免空宏可能会出现的一些语法玄学问题。

## 宏展开

### CHIKA_PROFILE_SCOPE

它展开后表层上做两件事 ——

1. 定义一个 static const uint32_t 变量，用来保存当前 profile name 对应的 ID
2. 定义一个 ProfilerScope 局部对象

（具体等后面对于`ProfilerScope`等的代码进行说明

同时使用`static const`可以使得函数执行到此处的时候不会重复申请空间生声明局部变量，比较有效率

### CHIKA_PROFILE_FUNCTION

一个小的简写 —— 把`CHIKA_PROFILE_SCOPE(__func__);`化简一下

### CHIKA_PROFILE_FRAME

创建一个 ProfilerFrameScope 局部对象，不需要名字，只需要 FrameID 即可

### CHIKA_PROFILE_COUNTER

用于记录运行时的数值

### CHIKA_PROFILE_INSTANT

结构上和 `CHIKA_PROFILE_COUNTER` 非常相似，同时额外说一下使用 do/while 包裹（其实总觉得在哪一篇写过）

使得多行语句表现得像单条语句，这样不容易破坏外部调用处的结构
# UE 输入系统

一个不错的高度解耦的系统。有点类似Unity新的（~~已经旧了~~）`Input System`

## 逻辑链条

以实现一个 Jump 功能为例，我们需要按下 Space 按键，然后让 Character 执行一次跳跃

首先，在硬件层面上，操作系统收到了键盘的物理按键信息。

### IMC

IMC (Input Mapping Context - 映射上下文)，类似于一位 Interpreter，负责把收到的物理按键信号翻译成一个抽象的引擎中信号。当然，也做了一些处理，比如通过添加Modifier对数据进行简单加工。

这样就做到了第一层的硬件设备到引擎上的解耦

一直监听信号，直到触发的时候，查表 —— 例如我们设定了 `IA_Jump` 信号，并且绑定 Space 按键，则IMC即实现了 `Space -> IA_Jump` 的映射功能

### IA

IA (Input Action - 输入动作)，一层抽象，约束了 Value Type —— 依赖倒置原则

（ Review 一下 DIP 原则

- 高层模块不应该依赖低层模块，两者都应该依赖其抽象。
- 抽象不应该依赖细节，细节应该依赖抽象。

就非常好，现在的链条是 ——

```text
底层硬件 -> IA <- 角色逻辑
```

### Blueprint

赋值做数据和逻辑隔离，在例子中即把`IA_Jump`这个资产赋值给在C++代码中声明的`UInputAction`。

避免了 C++ 内部硬编码资产路径 (`FObjectFinder`)，策划/美术可以随意重命名或移动输入资产而不引发 Error

### C++

具体的触发后逻辑可以在这边实现 —— 写好回调函数之后直接绑定即可，`EnhancedInputComponent->BindAction()`。于此同时，也提供了比较细分的状态，如

- `ETriggerEvent::Triggered`
- `ETriggerEvent::Completed`
-  等

这种广播机制不赖

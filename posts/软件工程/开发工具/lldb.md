---
tags:
  - 编译与工具链
  - 计算机底层
---

# lldb

日常 debug —— 古法在想要的断点处输出点什么 ( ~~比如 f-word ~~

这不赖,只是对于调用链条,内存泄露等比较难通过输出查看的问题,或者顿时一些规模比较大的项目,可能会比较难使用这种方法.

于是使用 debugger 来进行辅助 debug.

lldb 就是一个不赖的 debugger

## 基础知识

先简单说下 Process / Thread / Stack / Frame 等比较基础的概念.

假设我们有下面代码 ——

```C++
int main()
{
    Game game;

    game.Run();
}

void Game::Run()
{
    world_.Tick();
}

void World::Tick()
{
    player_.Update();
}

void Player::Update()
{
    health_ -= 10;
}
```

可以看出明显的运行关系 ——

```
main
 ↓
Game::Run
 ↓
World::Tick
 ↓
Player::Update
```

### Process

进程,也就是当某一个 Executable 运行的时候,系统会分配资源等让其运行起来,比如在执行`./game`的时候,可能会得到`PID=11451`,那么系统就是利用这个PID对应一个正在运行的进程,并且分配资源 ——

```
Virtual Address Space

Heap

Loaded Modules

Threads

File Descriptors

...
```

(详细可以看看进程线程的笔记)

### Thread

那么一个进程之内可以有多个线程,比如 ——

```
Game Process
 │
 ├── Main Thread
 ├── Render Thread
 ├── Audio Thread
 ├── IO Thread
 ├── Worker 0
 ├── Worker 1
 └── Worker 2
```

一般来说每个线程都有自己的 `Call Stack` 可以进行追踪

### Stack

回顾一下上面的运行链条,可以看出明显的调用关系,那么假设我们在追踪`Player::Update`的时候,就可以看到一个调用栈(Call Stack) ——

```
High Address

┌────────────────────┐
│ main frame         │
├────────────────────┤
│ Game::Run frame    │
├────────────────────┤
│ World::Tick frame  │
├────────────────────┤
│ Player::Update     │ ← 当前执行
└────────────────────┘

Low Address
```

(化简模型)

通常每个线程拥有自己的 Call Stack —— 一次函数调用通常会在这个 Call Stack 上产生一个新的 Stack Frame

### Frame

相当于对于上下文的一次记录,比如对于一个 Stack Frame, 我们就可以记录其中的局部变量, 传入参数等

### Debug Information

在编译之后, 为了让 Debugger 可以知道源码的概念(比如哪里存了什么变量等),需要在编译时生成 “Debug Information”.

比如在 clang 中使用 `-g` 来进行 Debug Information 的生成

Debug Info 会描述类似 ——

- 这个 Machine Code 对应哪一行源码
- 这个 Variable 名称是什么
- Variable 类型是什么
- 它属于哪个 Scope
- 当前存放在哪里
- Function 名称是什么
- ...

## 回到正文

简单说明下 lldb, 首先它是 LLVM Project 提供的 Debugger (废话)

在编译的时候, 上文提到要生成 Debug Information.除此之外,可能还会关闭编译器优化(比如开 `-O0` )等,来规避编译器优化导致的玄学问题(比如变量消失等)

我们用一个非常简单的例子进行说明 ——

```C++
#include <iostream>

struct Player
{
    int health = 100;
};

void Damage(Player& player, int damage)
{
    player.health -= damage;
}

int main()
{
    Player player;

    Damage(player, 20);

    std::cout
        << player.health
        << '\n';
}
```

编译之后使用 `lldb ./app` 进入 lldb (废话)

### Breakpoint

俗称断点,也就是让程序执行到指定位置的时候暂停,让我们得以查看一下帧栈等信息

```
breakpoint set --name Damage
breakpoint set --file game.cpp --line 42
breakpoint set --name 'EntitySystem::Update' --condition 'entity.id == 42'
b Damage
```

针对方法的写 / 针对文件的写 / 带条件的写 / 缩略的写

### Backtrace

在遇到断点的时候,可以先不着急 Continue(继续运行程序到下一处会导致程序中断的地方) 或者 Next (往下执行一行,遇到函数执行但不进入) 或者 Step (往下执行一行,但是遇到调用其他函数的时候会进入函数内部) 或者 Finish (继续执行当前函数直到 return，然后停回 caller)

而是先使用 `backtrace` / `bt` 来查看下当前调用情况(Call Stack), 比如在上述例子中,可能输出的结果即为

```
frame #0: Damage(Player&, int)
frame #1: main
```

说明当前在 Damage 这个函数中,是由 main 来发起调用的.

值得注意的是,里面每一层都是 Stack Frame, 可以通过 `frame select` / `up` / `down` 进行切换,然后查看上下文

### Frame Variable

现在我们还停在 `Damage(Player& player, int damage)` 这个函数的调用处,此时可以查看当前帧的上下文中的参数和局部变量 —— `frame variable`

这是查看当前上下文的所有变量

```
(Player &) player = ...
(int) damage = 20
```

或是单纯查看某一个变量 `frame variable damage`

### expression

p 表面上也是可以查看变量等,但是实际上它是执行表达式的语义 —— `p 1 + 2` 也是合法的,如果我们输入`p player.GetHealth()` 它就真的会在当前的被调试 Process 中执行 `player.GetHealth()`, 所以如果 p 的方法有“副作用”的话,可能会导致整个 debug 混乱

### watchpoint

用于追踪变量(实际上一块 Storage )的访问或修改 —— 它会让变量被修改的时候直接触发暂停

常见的写法有两种, 一是直接写 `watchpoint set variable x`, 表示我们追踪变量 x (会根据当前debugger所处的帧栈等进行分析);

不过也有更强大的写法 —— `watchpoint set expression -- &player.health` 就是 set 的是一个 expression 的结果,在此处例子中就是把 `player.health` 的地址取出来,作为要追踪的变量,也就是说,此时 watchpoint 实际上看的就是“这块内存的数据改变”,不过也会有问题,比如 vector reallocate 的时候导致原先地址失效等,此时指向旧地址等 watchpoint 不会随之移动,而是依旧盯着旧地址

### thread

thread 和 frame 非常的像,比如`thread list`,就是列出当前 Process 中的所有 Thread,以及每个 Thread 的当前状态和停止位置

```
* thread #1: Main
  thread #2: Worker
  thread #3: Render
```

然后 `*` 表示 lldb 现在选择的是 Main Thread 进行观察, 然后也可以借助 `thread select` 来进行切换.切换之后再执行`bt`的话就是查看当前所在的线程的上下文了

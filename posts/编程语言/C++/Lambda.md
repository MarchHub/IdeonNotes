# Lambda

快速的封装一个函数**对象** —— 注意，是一个匿名类对象

## 对象

```C++
auto add = [](int a, int b)
{
	return a + b;
};

int x = add(1, 2);
```

最简单的写法，实际上在语义上等价于 ——

```C++
struct SomeGeneratedCallable
{
    int operator()(int a, int b) const
    {
        return a + b;
    }
};

auto add = SomeGeneratedCallable{};
int x = add(1, 2);
```

因为它实际上是对象，所以才会有后面生命周期，各种妙妙捕获等的问题出现（

## 基础语法

（蛮看看，其实感觉没什么用

由于常说它是匿名函数，所以参数列表和函数体是必然有的，其返回值可以自动推断所以问题不大。

```C++
[capture](parameters) -> return_type
{
    body
};
```

| 部分               | 意义        |
| ---------------- | --------- |
| `[capture]`      | 捕获外部变量    |
| `(parameters)`   | 参数列表      |
| `-> return_type` | 返回类型，可以省略 |
| `{ body }`       | 函数体       |

## 捕获

把外部变量“拉”进Lambda生成的对象中 —— 保存副本或者引用

### 值捕获

和值传递一个道理，就是在表达式生成的时候完整复制一份变量

>[!note] 此处复制的对象要看它的复制语义是什么，比如基础类型就是直接复制，类对象调用其拷贝构造

先上例子
```C++
int x = 10;
auto addX = [x](int a){ return x + a; };
```

此处就是把环境中的 `x` 复制到表达式中，所以实际上表达式等价于返回`10 + a`

那么根据之前说的等价类的写法，

```C++
struct __Closure
{
    int x; // 捕获副本

    __Closure(int capturedX)
        : x(capturedX)
    {
    }

    int operator()(int a) const
    {
        return x + a;
    }
};

auto f = __Closure{x};
```

这样就比较清晰了，在初始化闭包对象的时候，环境变量会被传入作为构造函数参数，触发拷贝构造，所以具体的复制是怎么个复制法，得看环境变量

### 引用捕获

```C++
int x = 10;

auto f = [&x] { return x + 1; };

// 目前等价于 10 + 1
f();

x = 100;

// 此时等价于 100 + 1
f();
```

引用捕获是在闭包对象内部指向外部变量（起别名），所以会根据具体指向的数据变化而变化

语义上等价

```C++
struct __Closure
{
    int& x; // 实现上保存指针，语义上是引用原对象

    __Closure(int& capturedX)
        : x(capturedX)
    {
    }

    int operator()() const
    {
        return x + 1;
    }
};

auto f = __Closure{x};
```

此时就有可能出现垂悬指针的问题 —— 闭包捕获了一个已经被释放的变量的引用，在释放的时候出现未定义行为（**闭包不会延长捕获对象的生命周期**

```C++
std::function<void()> Make()
{
    int x = 10;

    return [&x]
    {
        std::cout << x << "\n";
    };
}

auto f = Make();
f(); // 未定义行为
```

此时内部对象 `x` 实际上已经被释放了，所以出现未定义

### 默认捕获

默认按值捕获`[=]`和默认按引用捕获`[&]`

目前感觉有点像是值捕获和引用捕获的语法糖，它会自动捕获闭包内部使用到的外部变量，按照对应的规则（=表示值，&表示引用）

### 混合捕获

把值捕获和引用捕获混起来

```C++
int a, b, c;

auto f = [=, &c]{ c = a + b; };

// 等价于
auto f = [a, b, &c] { c = a + b; }; 
```

### 初始化捕获

C++14 开始引入的，`[name = expr]`，就是在捕获的使用允许使用表达式进行初始化 —— “声明一个成员变量，它通过这个表达式进行初始化”

这使得闭包变得灵活多了

比如更改名称 

```C++
auto f = [value = x] { return value; };
```

可使得捕获的变量名称更有“意义”一些。

#### 移动捕获

```C++
auto ptr = std::make_unique<Resource>();
auto f = [ptr = std::move(ptr)]() mutable {
	ptr->Use();
};
```

如果直接使用引用或者值捕获，就是爆，因为`unique_ptr`无法复制

其等价类为

```C++
struct __Closure
{
    std::unique_ptr<Resource> ptr;

    __Closure(std::unique_ptr<Resource>&& capturedPtr)
        : ptr(std::move(capturedPtr))
    {
    }

    void operator()()
    {
        ptr->Use();
    }
};

auto f = __Closure{std::move(ptr)};
```

这样就可以符合移动语义了，至于`mutable`是因为 —— 默认lambda表达式中的`operator()`是`const`修饰，而我们需要内部成员可以被修改(比如`ptr->reset()`)，所示用`mutable`关键字修饰

不过实际上如果 `Use` 也是 `const` 修饰的成员函数的话，确乎是可以不用`mutable`进行修饰

#### 引用初始化捕获

有一种玄妙的写法`[&a = x]` —— 定义一个成员引用变量，指向外部的`x`变量，看似和引用捕获没什么区别，实际上如果单纯只是这么用，大抵确乎是没太大区别的。

不过由于右侧可以是表达式，于是 ——

`[&a = std::as_const(data)]` 这样一方面我们使用引用捕获可以高效的传递一个大的对象，另一方面，使用`as_const`保证了数据是只读的

### 关于类相关捕获

#### `this` 捕获

最朴素的写法
```C++
class Player
{
public:
    int hp = 100;

    auto MakeCallback()
    {
        return [this]
        {
            return hp;
        };
    }
};
```

此处的 this 只是复制了一个指针

```C++
struct __Closure
{
    Player* self;

    __Closure(Player* capturedThis)
        : self(capturedThis)
    {
    }

    int operator()() const
    {
        return self->hp;
    }
};
```

也可以在闭包里写`this->hp`，只是和类内部省略一个道理，可以简略一下

不过这样的问题也比较明显，就是保存的是裸指针，要考虑下类对象的生命周期问题 ——

```C++
std::function<int()> f;
{
    Player p;
    f = p.MakeCallback();
}

f(); // 未定义行为
```

值得注意的，如果在此处写默认值捕获和默认引用捕获在实现上也是通过捕获`this`进行的，而**不是**复制了一份成员变量，其区别只是针对当前作用域下的局部变量是怎么捕获进闭包里的而已。所以建议 —— **好好写`this`，对于其他要捕获的也好好写清楚是怎么捕获**

当然，如果真的要“拷贝”一份成员变量，可以使用初始化捕获方式，比如`[hp = hp]`

#### `*this` 捕获

解引用然后完整复制一份捕获进来，也就是存了一份副本，此处就要考虑对象的拷贝实现了，烦琐（

```C++
auto selfCopy = *this;
```

类似这样的赋值

## 一些具体使用

比如在STL中使用匿名函数烂大街了，回调方法传入匿名表达式等也都比较常见，那就不写了，主打一个懒（

## 总结

总的来说，在写闭包的时候，一方面要考虑意义，另一方面要考虑捕获环境变量的语义和生命周期 ( 废话这块

# const

讲述const在各个位置的语义和使用场景，其中 const 的作用时机主要是运行时（runtime），如果需要在编译期优先等，可以使用`constexpr`等关键字


使用const修饰成员函数，语义为 —— 承诺不改变对象，==只是语义上==；可以结合`mutable`进行缓存

```C++
class Foo
{
  public:
    int GetSource() const; // 成员函数内部不对类进行修改操作
  private:
    int source = 10;
};
```

使用const修饰函数参数，参数为只读，不修改
```c++
void foo(const int x); // x 在函数体内只读，无法被修改
```

修饰返回引用，说明返回的是只读引用，无法拷贝以及修改内部状态
```C++
const std::string& GetName() const;
```

修饰智能指针，说明指针是不可变（不能reset/move等），但是指针指向的对象是可变的
```c++
const std::unique_ptr<Foo> p = std::make_unique<Foo>();

p = nullptr;           // 非法操作
p.reset();             // 非法操作
auto q = std::move(p); // 非法操作

p->x = 10;             // 合法操作
p->doSomething();      // 合法操作
```

修饰智能指针的类型，说明指针是可变的，但是指向的对象是不可变的（和上一个case相反）—— 我可以移交所有权，但是这个资源是只读的
其实可以看成“就近原则”，修饰什么，什么就是不可变的

```C++
std::unique_ptr<const Foo> p = std::make_unique<Foo>();
p.reset();                   // 合法
p = std::make_unique<Foo>(); // 合法
p->x = 10;                   // 非法
p->doSomething();            // 非法（除非是 const 函数）

```
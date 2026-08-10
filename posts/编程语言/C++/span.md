# span

简单来说,是对一段连续对象序列的非拥有视图 —— 比如我们通常会使用`vector`,`array`,或者其他方式来表示一段连续空间,那么提出`span`看似没有什么用途,不过为什么依然会频繁的出现在接口设计当中?

## 约定

首先 `span` 可以表示一种约定 —— 这里有一段连续存放的 `T` 类型对象. 对于动态长度的 `span`,可以把它概念化为 ——

```C++
template<class T>
class SpanLike {
  private: 
    T* data_;
    std::size_t size_;
};
```

也就是通过连续对象序列的首地址和元素数量描述这段序列. 但这只是便于理解的模型,标准并未要求 `span` 必须采用这两个数据成员;固定长度的 `span<T, N>` 也不一定需要单独存储长度.

所以符合这样表示的数据结构,我们都可以通过这个来进行访问,比如 `vector` `array` 等.所以这是一种约定. 这样在接口设计中,可以简单的把它看成一种抽象来看待,抹除了这种连续存储的数据接口的差异,使得接口可以复用(当然,template或者overload原则上也是可以实现的,只是使用`span`更加的简单与方便)

```C++
float Average(std::span<const float> values);
void Multiple(std::span<float> values, float scaler);
```

那么此时的 api 可以接受所有能够构造对应 `span`、元素类型兼容、连续且可取得长度的 range —— 这其实挺合理的,一方面我们不需要复杂的重载; 另一方面这样说明了这个接口传入参数的“最小需求”,即我们不需要像`vector`那样复杂的带有乱七八糟方法的参数,也不是局限在仅仅只能传入“c-style array”那样简单的指针,只要符合语义的(连续对象序列),都可以传入做计算

## 借用

在使用上有点像是使用一个指针指向传入参数(就是典型的借用罢), 不过仅仅是借用, 不拥有所有权 —— 构造和销毁 `span` 都不会构造或销毁底层对象,它仅仅用于读取或修改已有对象.

那么具体的是只读,或是其他之类的,就看 API 设计了. `std::span<const T>` 表示不能通过该视图修改元素;而 `const std::span<T>` 只是 `span` 对象本身为 `const`,仍然可以修改它指向的 `T`. 不过与此同时,记得检查拥有所有权的对象是否还存在就是(

## 性能影响

在这里测试的接口与负载中几乎没有可观察到的额外开销,

先给出 benchmark 的结果

| 接口                      | 元素数量 |    Time |     CPU |  Iterations |     Items/s |
| ------------------------- | -------: | ------: | ------: | ----------: | ----------: |
| `const std::vector<int>&` |       64 | 1.95 ns | 1.95 ns | 355,897,217 | 32.7635 G/s |
| `std::span<const int>`    |       64 | 1.98 ns | 1.98 ns | 357,589,844 | 32.2515 G/s |
| `const std::vector<int>&` |    1,024 | 36.1 ns | 36.1 ns |  19,758,216 | 28.3596 G/s |
| `std::span<const int>`    |    1,024 | 36.1 ns | 36.1 ns |  19,572,043 | 28.3674 G/s |
| `const std::vector<int>&` |    4,096 |  148 ns |  148 ns |   4,830,118 | 27.6277 G/s |
| `std::span<const int>`    |    4,096 |  148 ns |  148 ns |   4,780,376 | 27.6167 G/s |

| 接口                        | 元素数量 |    Time |     CPU |  Iterations |     Items/s |
| --------------------------- | -------: | ------: | ------: | ----------: | ----------: |
| `const std::array<int, N>&` |       64 | 1.99 ns | 1.99 ns | 355,571,810 | 32.1931 G/s |
| `std::span<const int>`      |       64 | 1.99 ns | 1.99 ns | 352,187,082 | 32.1446 G/s |
| `const std::array<int, N>&` |    1,024 | 52.6 ns | 52.6 ns |  13,399,181 | 19.4639 G/s |
| `std::span<const int>`      |    1,024 | 52.6 ns | 52.6 ns |  13,243,279 | 19.4507 G/s |
| `const std::array<int, N>&` |    4,096 |  196 ns |  196 ns |   3,608,322 | 20.9383 G/s |
| `std::span<const int>`      |    4,096 |  196 ns |  196 ns |   3,582,688 | 20.9086 G/s |

这组结果中,它和直接使用`const std::vector<T>&`或`const std::array<T, N>&`的写法没有明显差别. `span` 的构造本身不会复制元素,也不会申请底层存储;不过这个结论仍然只适用于当前编译器、优化选项和测试负载.

## 底层设计

```C++
template<
    class ElementType,
    std::size_t Extent = std::dynamic_extent
>
class span;
```

模板参数 `Extent` 始终是编译期常量. 当它是 `std::dynamic_extent` 时,实际元素数量在运行期保存;当它是固定值 `N` 时,元素数量由类型 `std::span<ElementType, N>` 本身表达.

构造函数提供了针对`C-style array`,`std::array`,迭代器与数量、迭代器与哨兵以及 range 的重载;`vector`通过通用的 range 构造函数适配,并没有专门针对`vector`的重载,比较舒服

此处编译期的要求大体上是 ——

```C++
std::ranges::contiguous_range<R>
std::ranges::sized_range<R>
```

并且元素类型必须兼容. 对 range 构造函数来说,还要求 `R` 是 `borrowed_range`,或者 `span` 的元素类型为 `const`. 所以类似`map`,`deque`,`list`之类的就无法传入进行构造;`vector<bool>`也不满足普通连续元素序列的要求.

不过值得说的是 ——

```C++
template<class R>
span(R&& range);
```

构造函数声明的时候使用了引用转发的玩法(**forwarding reference**), 一般来说对于借用的场景,我们应当传入左值,那么为什么不直接写死成 ——

```C++
template<class R>
span(R& range);
```

这样呢?

好问题!(自问自答,不过不是AI写的,本人确认✅)

`R&&`首先使模板可以根据值类别推导并接受左值 range;同时,在上述约束允许时,也可以接受右值 range. 构造函数是否调用`std::forward`并不是这里的关键:形参 `range` 在函数体内是有名字的左值表达式,构造过程只需要通过它读取首地址和元素数量,但这不会延长原 range 的生命周期.

这样可以使得下面的语句合法 ——

```C++
consume(
    std::span<const int>{
        make_vector()
    }
);
```

这里之所以合法,还因为目标类型是 `std::span<const int>`:对于不满足 `borrowed_range` 的右值 range,range 构造函数只允许构造只读元素类型的 `span`. 临时 `vector` 会存活到包含这次函数调用的完整表达式结束,所以在 `consume` 调用期间访问是安全的(前提是`consume`方法不保存这个`span`对象). 如果把得到的 `span` 保存到该完整表达式之后,它就会立即悬空.

## 生命周期

除了拥有底层对象的对象生命周期外,还需要考虑元素生命周期以及指针、引用的失效规则 —— 比如在指向一个`vector`对象的过程中,如果它发生了`reallocate`的操作,原有元素地址会全部失效,但是此时`span`仍然保存着旧地址,继续访问会产生未定义行为. 即使没有重新分配,`erase`,`clear`或缩小`resize`等操作也可能销毁 `span` 所覆盖的元素,而 `span` 保存的长度不会随容器自动更新.

## 总结

说的比较水,不过能记得`span`是表示借用、不拥有元素,并以首地址和元素数量描述一段连续对象序列的视图应该即可.

与此同时,对于所有借用语义的结构来说,记得其生命周期的坑点即可(底层对象和元素的生命周期,以及地址失效问题)

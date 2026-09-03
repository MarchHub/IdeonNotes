---
tags:
  - C++
  - 函数式编程
---

# Ranges

很帅气的写法, 我们还是从一个实际案例来说, 假设现在有 ——

```C++
struct Entity
{
    bool active;
    float health;
};

std::vector<Entity> entities;
```

那么现在我们需要“找到所有存活的 Entity, 并且获取它们的生命值?”

朴素的, 可以 ——

```C++
std::vector<float> healths;

for (const auto& entity : entities)
{
    if (entity.active)
    {
        healths.push_back(entity.health);
    }
}
```

不过实际上数据是经过一个 ”pipeline“ 的 —— 先过滤出 `active` 的 Entity, 然后获取 `health`

那么我们就可以这么写 ——

```C++
auto healths =
    entities
    | std::views::filter([](const Entity& e)
      {
          return e.active;
      })
    | std::views::transform([](const Entity& e)
      {
          return e.health;
      });
```

返回的结果没有什么变化, 但是我们的思路从单纯的“命令流“转化成了一条数据管线.

## Ranges

先回到主题, 我们经常在调用 STL 的时候 —— `std::sort(nums.begin(), nums.end())` 也就是不断的通过传递迭代器来表示一个区间, 那么不妨打包一下进行一个化简, 看下 `Ranges` 的定义

```C++
template<class T>
concept range = requires(T& t) {
    std::ranges::begin(t);
    std::ranges::end(t);
};
```

从语法要求来看其核心就是 `begin()` 和 `end()` , 不过实际上还有其他的语义要求, 参考[cppreference](https://en.cppreference.com/cpp/ranges/range)

## Views

```C++
template<class T>
concept view =
    std::ranges::range<T>
    && std::movable<T>
    && std::ranges::enable_view<T>;
```

化简一些, 也是参考的 [cppreference](https://en.cppreference.com/cpp/ranges/view)

它确乎是一种 Range, 但是重点不再是“有什么数据”, 而是如何“”处理“”数据

## Range Adaptor

一个对于 Range 的操作对象, 同时可以把这些操作“接”到一起 (有点想到了修饰器模式) 形成 pipeline , 我们还是来看 ——

```C++
std::vector<int> nums{1, 2, 3, 4, 5, 6};

auto result =
    nums
    | std::views::filter([](int x) {
          return x % 2 == 0;
      });
```

那么此时的 `result` 并不是真的创建了一个 `vector` 返回, 而是返回一个 `view`, 说明了 ““遍历 `nums` 的时候, 只暴露满足这个 predicate 的元素” 这样一件事.

此处的 Adaptor 就是指操作, 而 View 表示经过操作之后的 Range 视图. 那么这个东西可以继续接续新的 Adaptor ——

```C++
auto result =
    nums
    | std::views::filter(isEven)
    | std::views::transform(square)
    | std::views::take(3);
```

就很好看, 比函数嵌套好看多了.

那么对于单个 `std::views::filter(isEven)` 来说, 它由于还没有传入需要进行操作的 Range, 所以相当于只是缓存了一次 Operator ——

```C++
auto evenFilter = std::views::filter(isEven);
auto a = nums1 | evenFilter;
```

## 懒惰求值

非常重要的

```C++
auto result =
    nums
    | std::views::filter(isEven)
    | std::views::transform(square)
    | std::views::take(3);
```

假设对于这样的操作, 实际上在创建 `result` 的时候, 并不会立刻执行 `filter -> transform -> take` 的操作. 而是在之后用到 `result` 的时候真正发生计算.

```C++
for (auto x : result)
{
    ...
}
```

比如这样

此时的逻辑类似于先对第一个元素进行`filter -> transform -> 返回`, 然后找到三个之后 `take` 停止, 那么整个计算也停止. 非常的不赖.

假设我们有一个很大的数据 `std::vector<int> nums(100'000'000)` 但是其实只需要前五个偶数的平方, 那么如果使用传统的 eager 的方法, 在每一个步骤显式的构造中间变量 ——

```C++
auto even = filter(nums);
auto squared = transform(even);
auto result = take(squared, 5);
```

这样会导致这 `100'000'000` 个元素全部进行运算, 非常的贵. 而使用 pipeline 则可以规避这样的问题.

有意思的例子 ——

```C++
auto r =
    std::views::iota(0)
    | std::views::filter([](int x) {
          return x % 2 == 0;
      })
    | std::views::take(5);
```

尽管我们使用了 `iota(0)` 来创建了一个“无限序列”, 但是依旧是因为 `take` 了前五个, 所以程序实际上不会一直跑下去.

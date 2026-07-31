---
tags:
  - ChikaEngine
  - 游戏引擎
  - 设计模式
---

# EventBus

实现了一个消息总线，订阅/发布，不多说

## 结构分析

### 存储

```C++
std::unordered_map<std::type_index, std::vector<Handler>> _handlers;
```

核心存储结构 —— 事件类型 -> Handler 列表

### Handler

```C++
struct Handler
{
    SubscriptionId id = 0;
    std::function<void(const void*)> callback;
};
```

表示一个订阅记录，包括一个唯一 ID（用于取消订阅） 和 回调函数

### Subscribe

```C++
template <typename Event>
SubscriptionId Subscribe(std::function<void(const Event&)> callback)
{
    const SubscriptionId id = ++_nextSubscriptionId;

    _handlers[typeid(Event)].push_back(Handler{
        .id = id,
        .callback = [callback = std::move(callback)](const void* event)
        { 
            callback(*static_cast<const Event*>(event));
        },
    });

    return id;
}
```

1. 自增ID
2. 根据事件类型查找对应的列表
3.  添加回调函数

订阅的时候先自增ID，同时返回给订阅者，用于取消订阅

这给`callback`赋值的写法可能比较复杂，复杂解释一下 ——

从内往外看，首先看 `callback(*static_cast<const Event*>(event));`

先把传进来的指针`const void* event`强制类型转化成`const Event*`类型，然后再解引用得到数据的引用，最后传递给`callback`调用

再看外层`.callback = [callback = std::move(callback)](const void* event)`

拆解表达式，就是把`.callback`赋值给一个`lambda`表达式

再看这个匿名函数，`[callback = std::move(callback)]`捕获列表的意思是把`Subscribe`函数参数里的`callback`（Subscribe函数的参数）移进 `lambda`，同时接受一个`const void* event`参数

还有一点，就是使用`std::move`，如果直接捕获的话表示拷贝语义，比较的肥厚（因为`std::function`打包的可能是一个复杂对象~~（此处留钩子）~~）

而使用`std::move`将左值强制转换为右值引用，从而可以触发类的移动构造函数，使得整个性能开销变得小（Efficient C++ 还在追）同时也非常符合现在的语境 —— 把回调交付给`EventBus`保存，所以把所有权交付给`EventBus`持有，于是使用`move`

综上所述，这边的`.callback`就是赋值给了一个

### Publish

```c++
template <typename Event> void Publish(const Event& event) const
{
	const auto it = _handlers.find(typeid(Event));
	if (it == _handlers.end())
		return;
	const auto handlers = it->second;
	for (const auto& handler : handlers)
		handler.callback(&event);
}
```

值得注意，
```c++
const auto handlers = it->second;
```
此处是把`handlers`进行了一次拷贝，所以在下面遍历的时候不是遍历原列表，好处是备份安全，防止回调执行过程中修改订阅列表（某个回调函数当中进行了取消订阅的操作），导致正在遍历的容器失效；坏处是有性能上的额外开销

### Unsubscribe

```C++
void Unsubscribe(SubscriptionId id)
{
    for (auto& [type, handlers] : _handlers)
    {
        std::erase_if(handlers, [id](const Handler& handler) 
        { 
            return handler.id == id; 
        });
    }
}
```

遍历所有事件类型的 handler 列表，然后删除 ID 匹配的 handler

## 使用

假设有一个伤害事件：

```C++
struct DamageEvent
{
    int entityId;
    float damage;
};
```

订阅：

```C++
ChikaEngine::Framework::EventBus eventBus;

auto subscriptionId = eventBus.Subscribe<DamageEvent>(
    [](const DamageEvent& event)
    {
        std::cout << "Entity " << event.entityId
                  << " took " << event.damage
                  << " damage.\n";
    }
);
```

发布：

```C++
eventBus.Publish(DamageEvent{
    .entityId = 1001,
    .damage = 25.0f
});
```

输出：

```
Entity 1001 took 25 damage.
```

取消订阅：

```C++
eventBus.Unsubscribe(subscriptionId);
```

再次发布：

```C++
eventBus.Publish(DamageEvent{
    .entityId = 1001,
    .damage = 50.0f
});
```

此时不会再输出任何内容。

## 注意

- 非线程安全
- 消息总线同步分发，顺序依赖注册顺序
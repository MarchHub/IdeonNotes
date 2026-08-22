---
tags:
  - ChikaEngine
  - 游戏引擎
  - 性能分析
---

# Profiler03-NameRegistry

如果热路径存储的是字符串，假设一直在每一帧运行的话 ——

- 字符串存储体积比较大
- 拷贝有额外成本
- 字符串比较比较慢
- 在 buffer 中存储字符串使得事件结构更复杂

所以做了一个简单的字符串驻留（`string interning`)，这样实际事件里后续存的是 `nameId`，不是完整字符串

这样在第一次注册的时候写进驻留表中，之后遇到只需查表即可

## 核心数据结构

```C++
mutable std::mutex m_mutex;
std::unordered_map<std::string, uint32_t, ProfilerNameHash, std::equal_to<>> m_ids;
std::vector<std::string> m_names;
```

简单来说

- m_mutex: 保护名字表，避免多线程同时注册时数据竞争
- m_ids: string -> id, 用来快速判断某个名字是否已经注册过
- m_names: id -> string, 用来通过 id 反查名字

## 细节

### string_view

在传入字符串的时候使用的是`string_view`, 先看`ProfilerNameHash` ——

```C++
struct ProfilerNameHash
{
    using is_transparent = void;

    size_t operator()(std::string_view value) const noexcept
    {
        return std::hash<std::string_view>{}(value);
    }
};
```

通过传入`string_view`减少临时的`string`构造

接着在`Intern`当中，只有确定这个字符串不在表内的时候，才开一个`std::string owned(name);`构建，分配内存

btw, 可以注意到在`ProfilerNameHash`中写到了`using is_transparent = void;` —— 为了支持 `heterogeneous lookup`，也就是“异质查找”（简单来说，允许在定义 `unordered_map` 的时候 `key` 的类型是 `string` 但是在查找的时候可以传入 `string_view`)

### 插入

在构造了真的`std::string owned(name);`的时候，可以注意到

```C++
m_names.push_back(owned);
m_ids.emplace(std::move(owned), id);
```

先在`vector`中进行了一次`push_back`，之后又进行了一次移动 ——

1. 第一次的`push_back`是复制，将字符串复制一份进入`vector`
2. 第二次的`emplace`是移动，不触发复制构造，减少了 map 插入时的一次额外拷贝

## Intern 逻辑

以第一次注册`"Renderer.Tick"`为例 ——

```C
Intern("Renderer.Tick")
  ↓
name 不为空
  ↓
加锁
  ↓
m_ids.find("Renderer.Tick")
  ↓
没找到
  ↓
id = m_names.size()
  ↓
m_names.push_back("Renderer.Tick")
  ↓
m_ids.emplace("Renderer.Tick", id)
  ↓
return id
```

## 总结

（说了这么多，实际上在 Runtime 的时候就是一个名字的字典而已
---
tags:
  - ChikaEngine
  - 游戏引擎
  - 性能分析
---

# Profiler04-Event 数据

定义 `ProfilerEvent` —— 把一次 profiler 的行为打包，形成一个固定格式，而不是随意乱写的数据（

## 数据定义

### 主体事件定义

```C++
struct alignas(8) ProfilerEvent
{
	uint64_t timestampNs = 0;
	uint64_t frameId = kInvalidProfilerFrameId;
	uint64_t payload = 0;
	uint32_t threadId = 0;
	uint32_t nameId = kInvalidProfilerNameId;
	ProfilerEventType type = ProfilerEventType::Instant;
	ProfilerEventFlags flags = ProfilerEventFlags::None;
	uint16_t reserved = 0;
};
```

其中 ——

- `timestampNs` 时间戳，记录事件发生的时间
- `frameId` 记录事件发生的那一帧
- `payload` 不同的事件有不同的语义 —— 记录数据使用
- `threadId` 记录事件来自的线程ID
- `nameId` 记录事件关联的名字（只记录 id 避免字符串转发）
- `type` 表示事件类型
- `flags` 表示事件附加信息
- `reserved` 为未来的拓展预留一块

### 事件类型

```C++
enum class ProfilerEventType : uint8_t
{
    // 帧标记，例如 frame begin / frame end。
    FrameMark,

    // CPU zone 开始。
    ZoneBegin,

    // CPU zone 结束。
    ZoneEnd,

    // 数值采样。
    Counter,

    // 瞬时事件。
    Instant,

    // 线程命名事件。
    ThreadName,
};
```

直接在注释说明，特别的

- Counter 只是数值的快照
- Instant 是**一个时刻**的标记点

此处使用`uint8_t`，大小为一个字节

### 事件附加标记

```C++
enum class ProfilerEventFlags : uint8_t
{
    // 没有特殊标记。
    None = 0,

    // 当前 FrameMark 是 frame begin。
    // 1u << 0u = 0000'0001
    FrameBegin = 1u << 0u,

    // payload 里面装的是 double 的 bit pattern。
    // 1u << 1u = 0000'0010
    FloatingPointPayload = 1u << 1u,
};
```

可以未来接上新的拓展标记之类的，不过当前代码里主要用到的是区分 ——

- `FrameMark` 是否是 frame begin
- `payload` 是否是 double

不过当前的代码中没有为 `ProfilerEventFlags` 定义 `operator|` / `operator&`。因此从这个模块本身来看，它更像是单 flag 使用；如果未来需要组合多个 flag，可以补充对应的位运算重载或显式转换。

## 小细节

### Event 对齐

在声明 `ProfilerEvent` 的时候使用了 `alignas(8)` 使得结构体至少按照 8 字节对齐，而 ——

```C++
uint64_t timestampNs  8
uint64_t frameId      8
uint64_t payload      8
uint32_t threadId     4
uint32_t nameId       4
ProfilerEventType     1
ProfilerEventFlags    1
uint16_t reserved     2
------------------------
合计                  36
```

那么向上补齐之后就是40字节（在源码中也有断言确认

相当于固定布局，这样在后期修改结构体字段的时候可以在编译期快速得知

### trivially copyable

我们还有一个断言，就是`static_assert(std::is_trivially_copyable_v<ProfilerEvent>);`

此处的意思是“让这个对象可以像一块普通字节数据一样复制” —— 因为后期我们需要频繁的在buffer 里移动 / 拷贝，所以强调避免在事件对象里引入 `std::string`、`std::vector` 等带动态资源的成员，这样再移动和拷贝的时候比较贵

### Pack / Unpack

此处略有意思，先看源码

```C++
inline uint64_t PackProfilerDouble(double value)
{
	return std::bit_cast<uint64_t>(value);
}

inline double UnpackProfilerDouble(uint64_t value)
{
	return std::bit_cast<double>(value);
}
```

此处是一个 pack / unpack double 类型的例子，看上去我们似乎是在做一个类型转化 —— `double -> uint64_t` 以及 `uint64_t -> double`，但是这个平常的 `static_cast` 不太一致，那个作为类型转化，在浮点到整型的时候会取整（比如`3.14->3`）。但是通过 `bit_cast` 的语义 —— “这就是这么些比特位，我只是"换一种形式存储"而已，不要去动里面的数据”
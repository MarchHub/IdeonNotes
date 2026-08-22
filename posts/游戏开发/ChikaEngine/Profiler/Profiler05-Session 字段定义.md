---
tags:
  - ChikaEngine
  - 游戏引擎
  - 性能分析
---

# Profiler05-Session 字段定义

先说明一下字段的定义，和 Session 比较简单的零碎边缘，把内部的具体实现留到下次说明

## Config

Session 的初始化配置表

```C++
struct ProfilerConfig
{
    // 初始化后是否立刻启用运行时采集。
    //
    // 注意：
    // 这是 runtime enabled，不是编译期 CHIKA_ENABLE_PROFILING
    bool enabled = true;

    // History 最多保存多少帧 capture
    size_t historyCapacity = 300;

    // 每个线程默认 event buffer 容量。
    size_t threadBufferCapacity = 65'536;

    // hitch 阈值，单位 ns。
    // 33,333,333ns大约是 33.33ms。
    uint64_t hitchThresholdNs = 33'333'333;
};
```

## Session 字段说明

可以看到有内部成员 ——

```C++
ProfilerThreadRegistry m_threads;
ProfilerAggregator m_aggregator;
ProfilerHistory m_history;
std::atomic<bool> m_initialized{ false };
std::atomic<bool> m_enabled{ false };
std::atomic<uint64_t> m_currentFrameId{ kInvalidProfilerFrameId };
uint64_t m_frameStartNs = 0;
uint64_t m_hitchThresholdNs = 33'333'333;
std::mutex m_frameMutex;
std::mutex m_gpuMutex;
std::unordered_map<uint64_t, std::vector<ProfilerGpuZone>> m_pendingGpu;
```

这些字段可以先粗分成四类：

1. 子系统对象
   - `m_threads`
   - `m_aggregator`
   - `m_history`
   - `m_pendingGpu`

2. 运行时状态位
   - `m_initialized`
   - `m_enabled`

3. 当前帧状态
   - `m_currentFrameId`
   - `m_frameStartNs`
   - `m_hitchThresholdNs`

4. 同步保护
   - `m_frameMutex`
   - `m_gpuMutex`

### 子系统

- `m_threads`：线程注册与线程事件 buffer 的入口，具体放到 ThreadRegistry 模块
- `m_aggregator`：帧尾聚合器，具体放到 Aggregator 模块
- `m_history`：保存已经完成的 frame capture，具体放到 History 模块
- `m_pendingGpu`：暂存尚未挂回 CPU frame 的 GPU timing

### 状态位

- `std::atomic<bool> m_initialized{ false };`
	- 记录 Session 是否已经初始化
- `std::atomic<bool> m_enabled{ false };`
	- 记录 Session 当前是否允许运行时采集事件

### 当前帧状态

使用 `std::atomic<uint64_t> m_currentFrameId{ kInvalidProfilerFrameId };` 进行记录当前帧的 ID

- m_currentFrameId == invalid: 当前没有打开 frame
- m_currentFrameId == 某个 frameId: 当前处于某一帧采集范围内

使用 

- `m_frameStartNs` 记录当前帧开始的时间
- `m_hitchThresholdNs` 判断一帧是否 hitch 的阈值

### 锁

使用 `std::mutex m_frameMutex;` 维护 frame 的相关状态，主要保护 BeginFrame / EndFrame 这一类 frame 生命周期操作中的状态一致性
使用 `std::mutex m_gpuMutex;` 维护 GPU pending 的相关状态

具体维护了什么状态在后期说明，同时值得注意的，此处使用`std::scoped_lock` 进行一次锁多个 mutex

这里它用来保证初始化 / 关闭时同时重置 frame 状态和 GPU pending 状态，不让两个状态被并发看到不一致，以初始化作为例子 ——

假设线程A在执行初始化方法，与此同时另一个线程B在提交 GPU Timing，而 `SubmitGpuTimings` 会在持有 `m_gpuMutex` 的情况下执行 GPU timing 关联逻辑。它会查询 / 替换 `m_history`，也可能写入 `m_pendingGpu`

假设初始化方法不锁`m_gpuMutex`的话，可能发生 ——

```
Thread A: Initialize()
  m_history.Clear()

Thread B: SubmitGpuTimings()
  发现 history 里没有这个 frame
  把 GPU timing 放进 m_pendingGpu

Thread A: Initialize()
  m_pendingGpu.clear()
```

导致 Thread B 刚提交的 GPU timing 可能被初始化清掉

另外的，`std::scoped_lock` 可以一次锁住多个 mutex，并使用标准库的死锁避免策略，比手写连续 `lock()` 更可以避免死锁的发生


# Profiler06-Session Event

聚焦外部调用 `BeginFrame / BeginZone / RecordCounter / RecordInstant` 后，Session 如何构造事件，并把它交给下一层，即 ——

```
ProfilerScope / FrameScope / Counter / Instant
  ↓
ProfilerSession
  ↓
ProfilerEvent
```

## BeginFrame

语义上是打开一帧 —— 从此刻开始，后续的 Zone / Counter / Instant 都归属于当前帧，写个注释

```C++
void ProfilerSession::BeginFrame(uint64_t frameId)
{
    // 运行时没有启用 profiler，就不打开 frame
    if (!IsEnabled())
        return;

    // frame 生命周期状态需要互斥保护
    std::lock_guard lock(m_frameMutex);

    // 当前帧开始时间
    m_frameStartNs = ProfilerClock::NowNanoseconds();

    // 标记当前正在采集的 frameId
    m_currentFrameId.store(frameId, std::memory_order_release);

    // 构造一个 frame marker 事件
    ProfilerEvent event;
    event.timestampNs = m_frameStartNs;
    event.frameId = frameId;
    event.type = ProfilerEventType::FrameMark;
    event.flags = ProfilerEventFlags::FrameBegin;

    // 交给统一 Record 入口
    Record(event);
}
```

## EndFrame

结束一帧，还是给个带注释的

```C++
void ProfilerSession::EndFrame(uint64_t frameId)
{
    // 如果当前打开的 frame 不是这个 frameId
    // 说明这次 EndFrame 不匹配，直接忽略
    if (m_currentFrameId.load(std::memory_order_acquire) != frameId)
        return;

    // 保护 frame 生命周期收束过程
    std::lock_guard lock(m_frameMutex);

    // 当前帧结束时间
    const uint64_t endNs = ProfilerClock::NowNanoseconds();

    // 构造一个 frame marker
    // 注意这里没有 FrameBegin flag，因此它表示 frame end ( 默认是 None
    ProfilerEvent event;
    event.timestampNs = endNs;
    event.frameId = frameId;
    event.type = ProfilerEventType::FrameMark;
    Record(event);

    // 当前不再有打开的 frame, 直接设成非法id
    m_currentFrameId.store(kInvalidProfilerFrameId, std::memory_order_release);

    // 帧尾：drain 所有线程事件，并交给 aggregator
    // 不过不展开 Aggregate / DrainAll 内部 只是先说下有这
    auto immutable = m_aggregator.Aggregate(
        frameId,
        m_frameStartNs,
        endNs,
        m_threads.DrainAll(),
        m_hitchThresholdNs);

    // 生成可进入 history 的 shared_ptr capture
    auto capture = std::make_shared<ProfilerFrameCapture>(*immutable);

    // GPU pending 与 history 发布需要保护
    {
        std::lock_guard gpuLock(m_gpuMutex);
        AttachPendingGpu(*capture);
        m_history.Add(std::move(capture));
    }
}
```

## BeginZone / EndZone

就更简单，构造一下`event`然后丢给`Record`入口即可

值得注意的，此处会返回`Record`的结果，来通知触发者是否记录成功（如果记录失败的话会不调用EndZone方法，在之前已经说过了，不再赘述

## RecordCounter

此处做了`int64_t`和`double`的重载，然后使用一个整形的模板把所有数据都丢给`int64_t`的重载进行实现

## RecordInstant

也是直接简单构造`event`丢给`Record`

## Record

核心部分，不过实际上单纯来看逻辑也不复杂 ——

```C++
bool ProfilerSession::Record(ProfilerEvent event)
{
    // 运行时关闭，直接拒绝记录
    if (!IsEnabled())
        return false;

    // 读取当前 frameId
    const uint64_t frameId = m_currentFrameId.load(std::memory_order_acquire);
    // 如果没有正在捕获的帧，则不记录 ( 无法把其放进 ProfilerFrameCapture 中
    if (frameId == kInvalidProfilerFrameId)
        return false;

    event.frameId = frameId;

    event.threadId = m_threads.GetCurrentThreadId();

    // 找到 / 注册当前线程，然后把事件推入该线程的 buffer
    return m_threads.GetOrRegisterCurrentThread()->TryPush(event);
}
```

**细节** —— 不直接用 `event.frameId`

虽然在 `Record` 之前传入的 `event` 都已经被填入了 `event.frameId`，但是此处依旧覆盖，使用`ProfilerSession`维护的`frameId`，保证所有事件都以 Session 当前状态为准

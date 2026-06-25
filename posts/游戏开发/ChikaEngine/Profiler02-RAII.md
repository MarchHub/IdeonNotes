# Profiler02-RAII

把 `ProfilerScope` 和 `ProfilerFrameScope` 做一次 RAII 封装，保证有`Begin`就一定有`End`

实际上有点像是“Trigger”，在作用域开始以及结束的时候触发`ProfilerSession`

## ProfilerScope

直接引用一下源码

```C++
/** @brief Balances zone events across every normal and exceptional scope exit. */
class ProfilerScope
{
  public:
    explicit ProfilerScope(uint32_t nameId)
        : m_nameId(nameId),
          m_active(ProfilerSession::Get().BeginZone(nameId))
    {
    }

    ~ProfilerScope()
    {
        if (m_active)
            ProfilerSession::Get().EndZone(m_nameId);
    }

    ProfilerScope(const ProfilerScope&) = delete;
    ProfilerScope& operator=(const ProfilerScope&) = delete;

  private:
    uint32_t m_nameId = 0;
    bool m_active = false;
};
```

构造函数 ——

- 初始化 `nameId`（在注册的时候返回，同时在声明这个Scope的时候会注入）
- 初始化 `active` （调用`Session`，返回的`bool`表示这个 zone 是否真的打开成功）

析构函数 —— **只有**在 `BeginZone` 成功时，才调用 `EndZone`

同时禁止拷贝构造和拷贝赋值，明确职责 —— 一个 guard 对象对应一次 Begin / End 责任，**不能**复制

## ProfilerFrameScope

```C++
class ProfilerFrameScope
{
  public:
	explicit ProfilerFrameScope(uint64_t frameId) : m_frameId(frameId)
	{
		ProfilerSession::Get().BeginFrame(frameId);
	}
	
	~ProfilerFrameScope()
	{
		ProfilerSession::Get().EndFrame(m_frameId);
	}

	ProfilerFrameScope(const ProfilerFrameScope&) = delete;
	ProfilerFrameScope& operator=(const ProfilerFrameScope&) = delete;

  private:
	uint64_t m_frameId = 0;
};
```

同理（

不过和 `ProfilerScope` 不同，`ProfilerFrameScope` 自己不保存 `m_active`。它在析构时总是调用 `EndFrame(m_frameId)`，是否真的有当前 frame 可以结束，交给 `ProfilerSession` 内部判断。
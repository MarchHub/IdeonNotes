# Job System

把一些可以并行执行的 CPU 工作交给 Worker 去做，比如资产加载、可见性计算、后台统计等。

核心思想 ——

```text
业务模块决定要做什么
JobSystem 只决定什么时候做、在哪个线程做、做完以后如何通知
```

也就是说，AssetManager 负责加载什么资产，Renderer 负责哪些渲染数据可以并行处理，而 JobSystem 本身不理解 Asset，也不理解 Renderer。

它只是一个调度器。

## 模块边界

```text
ChikaProfiler
    ↑
ChikaJobs
    ↑
    ├───────────────┐
    │               │
ChikaAsset      ChikaRender
    ↑               ↑
    └───────┬───────┘
            │
      EngineContext
```

`ChikaJobs` 只依赖 `ChikaProfiler`，不依赖 Asset 和 Render。

这样设计是为了让 JobSystem 保持干净：

- JobSystem 只理解 callable、Handle、队列和完成状态
- AssetManager 决定加载什么，JobSystem 只负责找 Worker 执行
- Renderer 决定哪些渲染数据能并行，JobSystem 不理解 RenderWorld
- Profiler 只接收事件，不反过来控制 JobSystem

## 简述

假设现在 AssetManager 想异步加载一个 Shader。

最简单的做法可能是直接开一个线程：

```C++
std::thread([path]
{
    LoadShader(path);
}).detach();
```

这看起来很方便，但问题非常多：

1. 线程数量不可控
2. 任务失败不好收集
3. 不知道什么时候完成
4. 关闭引擎时不好等待
5. Profiler 不知道任务在哪里跑
6. 多个模块都自己开线程，最后整套引擎会变成面条（

所以引入 `JobSystem`。

上层不直接创建线程，而是提交一个任务：

```C++
JobHandle handle = jobs.Schedule("Asset.LoadShader", []
{
    LoadShader();
});
```

JobSystem 内部负责：

- 把任务放进队列
- 唤醒 Worker
- 执行 callable
- 记录状态
- 捕获异常
- 通知等待者
- 在关闭引擎时统一收尾

这样业务层只关心“我要做什么”，不关心“线程怎么调度”。

## 总体数据流向

```text
外部模块 / 主线程
        │
        ▼
    Schedule Job
        │
        ▼
  JobStorage 分配 Slot
        │
        ▼
  放入可执行队列
        │
        ▼
    Worker 取任务
        │
        ▼
    执行 callable
        │
        ▼
  Completed / Failed / Cancelled
        │
        ▼
  Wait / Release / Detach
```

简单来说 ——

1. 外部模块提交任务
2. JobSystem 给任务分配一个内部位置
3. 任务进入队列
4. Worker 从队列中取出任务
5. Worker 执行任务
6. 调用方等待或放手不管
7. JobSystem 最后回收任务位置

## 结构分析

JobSystem 可以粗略分为五块：

|部分|作用|
|---|---|
|`JobSystem`|对外接口，负责 Schedule、Wait、Release|
|`JobStorage`|保存 JobSlot，记录状态、依赖、异常等|
|`JobQueue`|保存待执行的 JobHandle|
|`Worker Thread`|真正执行任务的线程|
|`JobProfiler`|记录任务开始、结束、队列等待等信息|

可以把它想成一个厨房：

|厨房类比|JobSystem|
|---|---|
|点菜单|`JobDesc`|
|取餐号|`JobHandle`|
|备餐架|`JobStorage`|
|出餐队列|`JobQueue`|
|厨师|`Worker Thread`|
|监控摄像头|`JobProfiler`|

## JobSystem 对外接口

```C++
class JobSystem
{
public:
    bool Initialize(const JobSystemCreateInfo& createInfo = {});
    void Shutdown(JobShutdownPolicy policy);

    JobHandle Schedule(JobDesc desc);
    JobHandle ScheduleAfter(std::span<const JobHandle> dependencies, JobDesc desc);
    JobHandle ScheduleChild(JobHandle parent, JobDesc desc);

    void Wait(JobHandle handle);
    bool Release(JobHandle handle);
    bool Detach(JobHandle handle);
};
```

上层最常用的其实就三个：

```C++
Schedule()
Wait()
Release()
```

普通任务大概这样：

```C++
JobHandle handle = jobs.Schedule("Gameplay.Update", []
{
    UpdateGameplayData();
});

jobs.Wait(handle);
jobs.Release(handle);
```

值得注意的

`Wait()` 只负责等任务结束，不负责回收。

所以等完以后还要 `Release()`。

## JobDesc

```C++
struct JobDesc
{
    SmallJobFunction function;
    uint32_t nameId = 0;
    JobTarget target = JobTarget::AnyWorker;
    JobFailurePolicy failurePolicy = JobFailurePolicy::Cancel;
};
```

`JobDesc` 就是任务描述。

它里面最重要的是 `function`，也就是这个任务真正要执行的代码。

例如 ——

```C++
jobs.Schedule("Asset.Load", []
{
    LoadAsset();
});
```

这里的 lambda 就会被打包进 `SmallJobFunction`。

### SmallJobFunction

`SmallJobFunction` 是一个小型 callable 容器，可以理解为一个“小任务盒”。

它适合保存很小的 lambda ——

```C++
auto request = std::make_shared<LoadRequest>();

jobs.Schedule("Asset.Load", [request]
{
    request->Execute();
});
```

注意这里捕获的是 `shared_ptr`，而不是把整个 `LoadRequest` 大对象塞进任务里。

这样做的原因 ——

- JobSystem 不应该保存大型业务对象
- JobSlot 是预分配的，如果每个 Slot 都很大，内存会爆
- 业务数据应该由业务模块自己管理
- JobSystem 只保存一个执行入口

所以这里的边界是 ——

```text
JobSystem 内部:
    JobHandle
    JobSlot
    state
    queue
    small callable

业务模块外部:
    LoadRequest
    Asset cache
    Render snapshot
    ShaderHandle
    TextureHandle
```

简单来说

```text
JobSystem 保存“怎么执行”
业务模块保存“执行时用什么数据”
```

## JobHandle

```C++
struct JobHandle
{
    uint32_t index;
    uint32_t generation;
};
```

`JobHandle` 是任务的身份，不是任务本体。

它有点像取餐号 ——

```text
handle = 12 号餐
```

但是只用 index 会出问题。

例如：

```text
Slot 12 原来是 Job A
Job A 完成后释放
Slot 12 被复用成 Job B
旧的 Job A handle 还拿着 index 12
```

如果不做检查，旧 handle 就可能误操作新的 Job B。

所以加入 `generation`：

```text
Handle(index=12, generation=4)
Slot 12 generation=4，有效

Slot 12 释放后复用
Slot 12 generation=5

旧 Handle(index=12, generation=4)
发现 generation 不同，拒绝访问
```

这就避免了 Slot 复用后的身份混乱。

（实际上和 Core 中的 泛型 Handle 没什啥区别

## JobStorage

`JobStorage` 是 Job 的内部存储池。

它不是每次 Schedule 都 new 一个对象，而是提前准备一批 Slot（对象池这块）

```text
free list
    -> Allocate index
    -> 初始化 JobSlot
    -> 返回 JobHandle
    -> 任务完成
    -> Release
    -> generation++
    -> index 回到 free list
```

- 内存规模明确    
- 不会无界增长
- Slot 地址相对稳定    
- 容量耗尽时可以明确返回 invalid handle

## JobSlot

`JobSlot` 是一个 Job 在 JobSystem 内部真正保存的状态。

关键字段 ——

| 字段                      | 含义                                       |
| ----------------------- | ---------------------------------------- |
| `generation`            | 当前 Slot 的世代，用来判断 Handle 是否过期             |
| `state`                 | 当前状态，比如 Created、Queued、Running、Completed |
| `function`              | 真正执行的 callable                           |
| `remainingDependencies` | 还有几个前置任务没完成                              |
| `unfinishedWork`        | 自己和子任务还有多少没完成                            |
| `exception`             | 执行时捕获到的异常                                |
| `parent`                | 父任务                                      |
| `dependents`            | 等待当前任务完成的后续任务                            |

这里容易混的是两个计数：

```text
remainingDependencies:
    这个任务开始前，还要等几个前置任务

unfinishedWork:
    这个任务结束前，自己和孩子还有多少工作没完成
```

例如

```text
Parse 依赖 Load
```

那么 Parse 的 `remainingDependencies` 一开始是 1。

又比如：

```text
Parent 创建了 3 个 Child
```

那么 Parent 的 `unfinishedWork` 要等自己和 3 个 Child 全部结束才归零。

## Job 状态

简化版状态流转：

```text
Free
  ↓
Created
  ↓
Queued
  ↓
Running
  ↓
Completed / Failed / Cancelled
  ↓
Release
  ↓
Free
```

简要说明 ——

- `Created` 表示已经创建，但可能还在等依赖    
- `Queued` 表示已经可以执行，正在队列里排队
- `Running` 表示已经被 Worker 取走执行
- `Completed` 表示正常完成
- `Failed` 表示 callable 抛异常或依赖失败
- `Cancelled` 表示还没执行就被取消

注意，没有单独的 `Waiting` 状态，如果一个任务在等依赖，它依然是 `Created`，只是不会进入可运行队列。

## JobQueue

当前队列使用的是有界 `std::deque<JobHandle>`，外面加 Mutex。

它提供三个操作

```C++
bool Push(JobHandle handle);
bool PopLocal(JobHandle& handle);
bool Steal(JobHandle& handle);
```

简单理解

| 操作         | 含义                 |
| ---------- | ------------------ |
| `Push`     | 把新任务塞进队列           |
| `PopLocal` | Worker 从自己的本地队列取任务 |
| `Steal`    | 空闲 Worker 从别人那里偷任务 |

这里暂时没有上无锁队列。（未来可期，但是无锁真的很恶心

无锁队列会引入更多并发细节，比如 ABA、内存顺序和回收问题。如果 Mutex 队列已经能通过压力测试，并且 Profiler 没证明它是瓶颈，就没必要一开始就把系统写成并发炼丹炉。

## 三类队列

### Injection Queue

外部线程和主线程提交的任务，一般先进全局队列。

```text
Main Thread / AssetManager / 外部模块
        ↓
Injection Queue
        ↓
任意 Worker 可以执行
```

### Worker Local Queue

Worker 在执行任务时创建的新任务，会优先进入自己的本地队列。

```text
Worker 0 正在执行 Parent
        ↓
Parent 创建 Child
        ↓
Child 进入 Worker 0 Local Queue
```

这样做可以利用缓存局部性。

因为刚创建出来的子任务，往往和当前 Worker 正在处理的数据有关。

### MainThread Queue

有些任务必须回到主线程执行，比如发布某些结果、触发主线程回调等。

这种任务会进入 MainThread Queue。

主线程每帧主动 Pump：

```C++
jobs.PumpMainThreadJobs();
```

注意：

MainThread Job 不是让 Worker 偷偷调用 Vulkan 或 ImGui 的许可证。

涉及 RHI、窗口、Editor 状态的东西仍然要遵守线程边界。

## Worker 如何找任务

每个 Worker 大概按这个顺序找活：

```text
1. 从自己的 Local Queue 取最新任务
2. 从全局 Injection Queue 取任务
3. 从别的 Worker Local Queue 偷较旧任务
4. 没活就 Deepsleep (
```

Local Queue 通常从尾部取，也就是 LIFO。

原因是最新创建的任务往往和当前数据更近，缓存更友好。

偷任务时通常从头部偷，也就是 FIFO。

原因是较旧任务往往粒度更大，更适合分给别人做。
## Schedule 流程

简化一下 ——

```text
Schedule
    -> 检查 JobSystem 是否还接受任务
    -> JobStorage 分配 Slot
    -> 初始化 JobSlot
    -> 注册依赖
    -> 如果没有依赖，放入队列
    -> 返回 JobHandle
```

有依赖的任务不会马上进入队列。

例子

```C++
JobHandle load = jobs.Schedule("Asset.Load", [] { LoadData(); });

JobHandle parse = jobs.ScheduleAfter(
    std::span(&load, 1),
    "Asset.Parse",
    [] { ParseData(); }
);
```

这里 `parse` 要等 `load` 完成以后才会进入队列。

## Execute 流程

Worker 取到任务后，大概这样执行：

```text
拿到 JobHandle
    -> 检查 generation 是否有效
    -> 把状态从 Queued 改成 Running
    -> 记录 Profiler
    -> 执行 callable
    -> 捕获异常
    -> 标记自己的工作完成
    -> 如果没有子任务和依赖收尾，进入终态
    -> 唤醒等待者
```

异常不会直接飞出 Worker 线程。

如果 callable 抛异常，JobSystem 会保存 `std::exception_ptr`。

之后调用方在 `Wait()` 的时候再重新抛出。

```C++
JobHandle handle = jobs.Schedule("Failing.Job", []
{
    throw std::runtime_error("load failed");
});

try
{
    jobs.Wait(handle);
}
catch (const std::runtime_error& error)
{
    // 在这里处理失败
}

jobs.Release(handle);
```

这样 Worker 不会因为一个任务炸掉而把整个线程池带走（把内部异常打包给上层处理

## 依赖任务

依赖任务表达的是 ——

```text
B 要等 A 完成以后才能执行
```

例子 ——

```C++
JobHandle load = jobs.Schedule("Asset.Load", []
{
    LoadData();
});

JobHandle parse = jobs.ScheduleAfter(
    std::span(&load, 1),
    "Asset.Parse",
    []
    {
        ParseData();
    }
);
```

流程大致

```text
load 执行
    -> load 完成
    -> parse 的 remainingDependencies--
    -> 如果归零
    -> parse 入队
```

依赖失败时，可以按策略处理 ——

| 策略          | 行为           |
| ----------- | ------------ |
| `Cancel`    | 前置失败，自己取消    |
| `Propagate` | 前置失败，自己也标记失败 |
| `RunAnyway` | 不管前置结果，仍然运行  |

首版只支持在 Schedule 时建立依赖，不支持运行中随便加边。（继续未来可期

## Parent / Child

Parent / Child 表达的不是“谁先执行”，而是“生命周期包含关系”。

例如：

```text
Parent 开始
    -> 创建 Child A
    -> 创建 Child B
    -> Parent 自己的 callable 返回
    -> Child A 完成
    -> Child B 完成
    -> Parent 才真正完成
```

所以 Parent callable 返回，不代表 Parent Job 已经完成。

它还要等所有 Child 完成。

这可以避免一种危险情况：

```text
Parent 已经释放
Child 还在访问 Parent 相关数据
```

Parent / Child 的目的就是让子任务被包含在父任务生命周期里。

（主要还是一个范围问题，大的被切成小的，至少得等所有小的结束才能说是大的成了

## Wait-help

这是 JobSystem 里比较重要的一点。

假设只有一个 Worker

```text
Worker 正在执行 Parent
Parent 创建 Child
Parent 立刻 Wait Child
Child 还在队列里
```

如果 Worker 真的阻塞等待，就**死锁**了 😇 ——

```text
Parent 等 Child
Child 等 Worker
Worker 被 Parent 卡住
```

所以 Worker 调用 `Wait()` 时，不能傻等。

它需要一边等，一边继续帮忙执行其他 ready job。

这就是 Wait-help。

不同线程调用 `Wait()` 的行为不一样：

|调用线程|行为|
|---|---|
|Worker|不直接睡死，而是继续执行 ready job|
|主线程|Pump MainThread Queue，也可能协助 AnyWorker Job|
|普通外部线程|可以用 condition variable 阻塞等待|

这里有一个重要后果：

```text
AnyWorker Job 不一定只在 Worker Thread 上运行
```

因为主线程在 Wait-help 时，也可能协助执行普通任务。

所以 AnyWorker Job 不能假设自己一定不在主线程，也不能偷偷调用 Vulkan、ImGui 或窗口 API。

## Release 与 Detach

### Wait + Release

普通有结果的任务：

```C++
JobHandle handle = jobs.Schedule("Work", []
{
    DoWork();
});

jobs.Wait(handle);
jobs.Release(handle);
```

注意：

```text
Wait 只是等待
Release 才是释放 Handle 对应的 Slot
```

如果忘记 Release，Slot 就可能一直占着。

### Detach

Fire-and-forget 任务：

```C++
JobHandle handle = jobs.Schedule("Telemetry.Flush", []
{
    FlushTelemetry();
});

if (handle.IsValid())
{
    jobs.Detach(handle);
}
```

`Detach()` 表示调用方不再关心这个任务，把回收责任交给 JobSystem。

调用 `Detach()` 后，不应该再 Wait、查询或 Release 这个 Handle。

因为任务完成后 Slot 可能马上被复用，旧 Handle 可能已经失效。

## MainThread Job

有些工作必须回到主线程执行。

例如：

```C++
JobHandle handle = jobs.Schedule(
    "Publish.MainThread",
    []
    {
        PublishResult();
    },
    JobTarget::MainThread);
```

主线程需要定期调用：

```C++
jobs.PumpMainThreadJobs();
```

适合放 MainThread Job 的东西：

- 发布 Worker 生成的 CPU 结果
- 触发主线程回调
- 把异步结果交还给主线程系统

不适合放进去的东西：

- 长时间阻塞任务
- 大量 CPU 计算
- GPU 上传的复杂封装
- 可能拖慢 Frame Time 的工作

## ParallelFor

`ParallelFor` 是把一段循环拆成多个小块交给 JobSystem。

例如：

```C++
JobHandle handle = ParallelFor(
    jobs,
    objectCount,
    128,
    "Renderer.Visibility",
    [&](ParallelForRange range)
    {
        for (uint32_t i = range.begin; i < range.end; ++i)
        {
            ProcessObject(i);
        }
    });

jobs.Wait(handle);
jobs.Release(handle);
```

逻辑 ——

```text
计算 chunk 数量
    -> 每个 chunk 创建一个 Job
    -> 所有 chunk 完成后 Join
    -> 返回 Join handle
```

注意，并行任务不要随手写同一个共享 vector：

```C++
results.push_back(x); // 不推荐
```

因为线程完成顺序是不稳定的。

更推荐：

```C++
std::vector<std::vector<Result>> chunkOutputs(chunkCount);

ParallelFor(jobs, count, grain, "Build", [&](ParallelForRange range)
{
    auto& output = chunkOutputs[range.chunkIndex];

    for (uint32_t i = range.begin; i < range.end; ++i)
    {
        output.push_back(BuildResult(i));
    }
});
```

最后按 `chunkIndex` 顺序合并。

确定性来自：

```text
每个 chunk 写自己的输出
最后按固定顺序合并
```

而不是强迫线程按顺序执行。

## Shutdown

关闭时不能直接把 Worker 杀掉。

C++ 里也不能安全地强制停止一个正在运行的 callable。

所以 Shutdown 分两种思路。

### Drain

正常关闭用 Drain。

```text
拒绝新的外部提交
    -> 已经接受的任务继续执行
    -> 正在运行的任务可以创建必要的子任务
    -> 等所有任务完成
    -> 停止 Worker
    -> 回收队列和 Storage
```

这个适合正常 Engine Shutdown。

### CancelPending

快速关闭时可以取消还没开始的任务。

```text
拒绝新任务
    -> Created / Queued 任务取消
    -> Running 任务继续跑完
    -> 等 Running 结束
    -> join Worker
```

注意：

Running callable 不能被强杀。

如果一个长任务希望快速退出，需要自己检查取消标志。

## AssetManager 如何使用

异步加载资产时大概是：

```text
LoadShaderAsync(path)
    -> 去重 in-flight request
    -> 创建 promise / shared_future
    -> Schedule Asset.LoadShader
    -> Worker 读取文件并解析
    -> AssetManager 提交到缓存
    -> promise 发布 ShaderHandle
```

Asset Job 通常可以 `Detach()`。

因为业务结果已经由 `shared_future` 管理，外部不需要直接持有 JobHandle。

JobSystem 不接管这些东西：

- Asset GUID
    
- CPU Asset Handle
    
- Asset cache
    
- GPU Resource Handle
    
- 热重载规则
    

这些仍然属于 AssetManager / ResourceManager。

## Renderer 如何使用

Renderer 可以把一些纯 CPU、只读输入、独立输出的工作交给 JobSystem。

例如：

```text
Renderer.Visibility.Main
Renderer.Visibility.Shadow
```

它们可以读取不可变的 `RenderWorldSnapshot`，分别写自己的 `VisibilityResult`。

主线程 Wait 后继续构建 Render Queue。

但这些东西不应在 Worker 里做 ——

- Vulkan / RHI 调用
- ImGui 调用
- ResourceManager 查询和 GPU 上传
- RenderGraph Execute
- 依赖主线程状态的窗口操作

如果 Job 提交失败或执行失败，Renderer 应该能回退到串行路径，避免一帧直接炸掉。

## Profiler

JobSystem 会给 Profiler 发事件，例如：

```text
Jobs.Enqueue
Jobs.Start
Jobs.Complete
Jobs.Fail
Jobs.Cancel
Jobs.Steal
```

这样 Editor Timeline 里可以看到：

```text
Main Thread: Jobs.Enqueue(handle X)
Worker 2:    Jobs.Start(handle X)
Worker 2:    Asset.LoadShader
Worker 2:    Jobs.Complete(handle X)
```

>[!note]
>Profiler 不参与调度，只负责观察。

## 统计信息

`GetStatistics()` 可以返回一些调度器当前状态。

比较有用的字段：

|字段|含义|
|---|---|
|`submittedJobs`|提交成功的任务数|
|`completedJobs`|正常完成的任务数|
|`failedJobs`|失败任务数|
|`cancelledJobs`|取消任务数|
|`localPops`|Worker 从自己队列取任务次数|
|`successfulSteals`|成功偷任务次数|
|`queueWaitNanoseconds`|任务排队等待时间|
|`executionNanoseconds`|任务执行时间|
|`activeWorkers`|当前活跃 Worker|
|`sleepingWorkers`|当前睡眠 Worker|
|`queuedJobs`|当前等待执行的任务数|

用于判断

- 任务是不是太碎
- Worker 有没有吃满
- 队列是不是瓶颈
- steal 是否频繁
- 并行化是否真的有收益

## 性能边界

Job 不是越多越好。
如果一个任务只有 1 微秒，单独调度它通常不值得。
原因是调度本身也有成本：

```text
创建 Job
放入队列
唤醒 Worker
切换状态
记录 Profiler
回收 Handle
```

所以应该把足够大的 CPU 工作提交为 Job。

粗略理解 —— 

|任务粒度|是否适合单独调度|
|---|---|
|1 us|通常不适合|
|10 us|接近盈亏边界|
|100 us|开始比较值得|
|1 ms|很适合并行|

具体阈值要看真实 Profiler 数据（所以之前先实现 Profiler 模块是对的

## 实际使用例子

### 普通任务

```C++
JobHandle handle = jobs.Schedule("Gameplay.Update", []
{
    UpdateGameplayData();
});

jobs.Wait(handle);
jobs.Release(handle);
```

### 依赖任务

```C++
JobHandle prepare = jobs.Schedule("Prepare", []
{
    Prepare();
});

JobHandle consume = jobs.ScheduleAfter(
    std::span(&prepare, 1),
    "Consume",
    []
    {
        Consume();
    },
    JobFailurePolicy::Propagate);

jobs.Wait(consume);
jobs.Release(prepare);
jobs.Release(consume);
```

### Fire-and-forget

```C++
JobHandle handle = jobs.Schedule("Telemetry.Flush", []
{
    FlushTelemetry();
});

if (handle.IsValid())
{
    jobs.Detach(handle);
}
```

### 主线程发布

```C++
JobHandle handle = jobs.Schedule(
    "Publish.MainThread",
    []
    {
        Publish();
    },
    JobTarget::MainThread);

jobs.Wait(handle);
jobs.Release(handle);
```

## 注意

- `Wait()` 不等于 `Release()`
- `Detach()` 后不要再碰这个 Handle
- AnyWorker Job 不要调用 Vulkan、ImGui、窗口 API
- 不要捕获可能提前销毁的裸指针
- 不要为特别碎的小任务创建大量 Job
- 不要假设 Job 一定在哪个 Worker 执行
- 不要假设 AnyWorker Job 一定不会在主线程执行
- Shutdown 后不要继续提交外部任务
- 并行输出要尽量使用 chunk 独占结果，然后确定性合并

## 最后

解耦 ——

```text
JobSystem 只负责调度
业务模块负责业务数据
```

（扯上实际运用 ——

```text
AssetManager 知道资产是什么
Renderer 知道渲染数据是什么
JobSystem 只知道这里有个任务要执行
```

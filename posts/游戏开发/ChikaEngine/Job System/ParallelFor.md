---
tags:
  - ChikaEngine
  - 并发编程
  - 异步与调度
---

# ParallelFor

简单说下这个方法的设计, 其实非常的简单, 就是上游业务调用的时候, 可以把一个大的 Range 拆分成若干小的 Chunk 然后进行并行执行.

比如说要做可见性剔除的操作, 我们有 1b 个物体

```C++
for (auto go : gameobjects)
	operate(go);
```

这显然是一个非常贵的操作, 于是就可以调用 `ParallelFor` 来把这个大的数据拆成若干小的部分执行操作.

## 数据流动

我们借助一次 ChikaEngine 的真实调用来说 —— `BuildVisibilityParallel` 可见性剔除, 对于每一个 GO 的可见性剔除操作是彼此无关的, 所以与其使用一个循环进行串型运算, 不如直接交给 `ParallelFor` 进行并行运算.

### 准备 ParallelFor 参数

查看 `BuildVisibilityParallel` 的实现

```C++
const uint32_t count = static_cast<uint32_t>(instances.size());
const uint32_t safeGrain = std::max(1u, config.grainSize);
const uint32_t maximumChunks = std::max(1u, jobs.GetMaximumParallelChunks());
const uint32_t chunkCapacity = std::min((count + safeGrain - 1u) / safeGrain, maximumChunks);
std::vector<VisibilityResult> chunks(chunkCapacity);
```

- `count` 当前这一帧需要检查多少个 `RenderInstance` —— 所以 ParallelFor 的工作空间就是 `[0, count)`
- `safeGrain` 大概分割每个 Chunk 的大小
- `chunks` 提前创建每个 `chunk` 操作的输出存储位置

### 调用

```C++
const Jobs::JobHandle parallel = Jobs::ParallelFor(
	jobs,
	count,
	safeGrain,
	"Renderer.Visibility.Chunk",
	[&](Jobs::ParallelForRange range) { ... }
)
```

传入 `jobs` 表示当前的方法要把任务拆分到哪个 `JobSystem` 中, 正常传入参数(还是一如既往的喜欢说废话), 最后的 lambda 表示对于每一个 Chunk 我们要执行什么操作.

### 进入 ParallelFor

进行一波运算 (比如 Range 其实比较小就直接打包提交给 JobSystem 之类的)

然后拆分 Range 成若干 Chunk 并且给丢给 JobSystem ——

```C++
[sharedFunction]()
{
    (*sharedFunction)(
        {0, 128, 0});
}

[sharedFunction]()
{
    (*sharedFunction)(
        {128, 256, 1});
}

...
```

类似这样的东西

### 总结

那么请 G 老师重新展示 ASCII 艺术 ——

```
                   RenderSceneView
                         │
                         ▼
                scene.GetInstances()
                         │
                         ▼
                  instances[]
                         │
                         │ shared read
                         ▼
              BuildVisibilityParallel
                         │
                         ▼
     ParallelFor(count, grain, lambda)
                         │
                Split [0,count)
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      Chunk0          Chunk1          Chunk2
      [0,128)        [128,256)       [256,384)
         │               │               │
         ▼               ▼               ▼
       Job0             Job1            Job2
         │               │               │
         └───────────────┼───────────────┘
                         ▼
                      JobSystem
                         │
                         ▼
                 Worker Scheduling
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
    Worker0           Worker1           Worker2
       │                 │                 │
       ▼                 ▼                 ▼
 functor(range0)   functor(range1)   functor(range2)
       │                 │                 │
       ▼                 ▼                 ▼
 instances[0..]    instances[128..]  instances[256..]
       │                 │                 │
       ▼                 ▼                 ▼
  Visibility Test    Visibility Test  Visibility Test
       │                 │                 │
       ▼                 ▼                 ▼
   chunks[0]          chunks[1]          chunks[2]
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
                    Join / Wait
                         │
                         ▼
                  Merge chunks[]
                         │
                         ▼
                 VisibilityResult
```

做了一个简单示意图, 大体确乎如此, 不过真实情况需要看 JobSystem 的调度结果

## ParallelFor

现在回到 “正题” 稍微说说这个函数的设计.

首先传进来的 Callable 要是可以说明对于 `ParallelForRange` 来说要怎么进行操作.

```C++
using StoredFunction = std::remove_cvref_t<Function>;

auto sharedFunction = std::make_shared<StoredFunction>(std::forward<Function>(function));

```

先获取数传入的 Callable 类型, 然后做一个引用转发, 用 `make_shared` 进行存储这个方法. 使用 `make_shared` 是因为后面拆分成若干 Chunk 丢给 JobSystem 的时候, 这份 Functor 不是谁独占所有权, 没有谁可以保证自己最后被执行完并且来做内存释放. 所以使用 `shared_ptr` 来进行实现, 让这个 Function 的生命周期可以覆盖所有的 Chunk 执行生命周期.

接着我们进行拆分 ——

```C++
for (uint32_t chunkIndex = 0; chunkIndex < chunkCount; ++chunkIndex)
{
	...
}
```

此处除了创建 Job 之外, 我们还记录其 Handle.

拆分结束之后

```C++
JobHandle join = jobs.ScheduleAfter(chunks, "ParallelFor.Join", [] {}, JobFailurePolicy::Propagate);
```

借助一次空任务来建立所有 chunk 的依赖关系, 这样返回这个 `join` 后的任务的 `Job Handle`, 之后在业务代码调用 `Wait` 的时候就是对所有数据的 `Wait` (其他操作同理).

## 异常分析

首先上游业务代码调用 `ParallelFor`, 然后它一路执行, 如果此时在构造 Chunk 丢给 JobSystem 的时候遇到错误. 那么

```C++
JobHandle chunk = jobs.Schedule(name, [sharedFunction, begin, end, chunkIndex]() { (*sharedFunction)(ParallelForRange{ begin, end, chunkIndex }); });
if (!chunk.IsValid())
{
	Detail::CleanupParallelChunks(jobs, chunks);
	throw JobCapacityError("failed to schedule ParallelFor chunk");
}
```

抛出异常, 同时说明是在 `ParallelFor` 当中构造 Chunk 的时候的异常, 原因是 `JobCapacityError`

同时执行一次 `Cleanup` —— 等待之前已经创建过的 Chunk 全部执行结束并且 Release, 消费掉之前创建的 Chunk —— 那么在 `wait` 的时候也有可能抛出异常, 此时我们把 `catch(...)` 留空, 保证不会在消费 Chunk 的时候被打断, 这样才能正确的消费掉所有的 Chunk. 同时不会打断上层调用的时候抛出的问题 `JobCapacityError`, 这才是主要错误.

这个逻辑在 `join` 这个依赖任务创建的时候也是同理.

以及如果在 JobSystem 内部出现了问题, 不好意思, 此时 `ParallelFor` 可能早就 return 返回了, 所以这个错误不会传递到 `ParallelFor` 中, 以及就算出现了什么玄学错误被传播到了这个方法中, 我们也没有对应的 catch —— 非常简单, 因为这只是一个 “中间件”, 也不应当有什么处理异常的能力.

## 总结

爽点, 底层数据不需要做所有权等的移交, 上层只是一直不断的在借用而已(传递一个引用); ParallelFor 不需要知道具体的“数据”是什么, 只需要知道范围. 也不需要知道怎么调度, 这不是它的职责; JobSystem 只管每个 Job 的调度, 然后执行这个 Job 即可, 不知道底层数据, 不需要知道 Chunk 的概念.

这很 “单一职责”, 不赖.

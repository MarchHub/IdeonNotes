# JobStorage

存储Job数据的地方(看名字也非常显然), 看 API 非常好理解其用法用途, 不过还是稍微说下其中的一些设计

## Job Slot

定义一个 Runtime Job 的存储结构, 有点类似 PCB 那样, 不是单纯的存储 Callable (其实是之前说的 SmallJobFunction), 而是存储生命周期(state), 依赖, 调度方式等各种东西, 所以其实比较繁琐,鉴定为自己查看源代码去(

那么此处也是使用了 `generation` 的设计, 让 Slot 复用的时候不会出现访问旧数据的问题(详情可以查阅一下之前笔记)

## JobStorage

和 Slot 比起来就简单许多, 主要字段是 ——

```C++
size_t m_capacity = 0;
std::unique_ptr<Detail::JobSlot[]> m_slots;
mutable std::mutex m_freeMutex;
std::vector<uint32_t> m_freeIndices;
std::atomic<size_t> m_activeCount{ 0 };
```

### unique_ptr

那么这边第一个“巧思”是 `std::unique_ptr<Detail::JobSlot[]> m_slots;`, 首先对于 Slot 的存储, 我们确乎是可以使用 vector, 不过缺点在于, 如果不小心触发 Reallocate 操作的话, 那么会导致旧的地址失效时一方面的问题. 另一方面我们存储的 JobSlot 类型包含有

```C++
std::atomic<uint32_t>
std::atomic<JobState>
std::mutex
std::condition_variable
```

等不可复制或移动的对象, 那么在比如触发 vector 扩容的时候, 它需要移动 / 复制旧数据, 于是可能导致相关代码编译无法通过( 比如触发扩容等的时候会做编译期判断是否可复制,可移动) —— 单纯的声明 `std::vector<JobSlot> jobs(N)` 是可行的, 只是如果后面遇到 Reallocate, `JobSlot` 不可移动的问题就会出现, 导致编译错误.

所以为了表示一段固定长度, 地址稳定的数组, 于是采用了`std::unique_ptr<T[]>`的写法. 那么之所以又不用 `std::array` 的原因, 是它的长度需要在编译期就确定, 而我希望把这个开辟空间的行为延迟到 Runtime 的时候利用传入的 `capacity` 再进行开辟, 所以使用上述结构. 在语义上微微地有一点类似 `int* p = new int[N];` 但是被 RAII 管理器包装的感觉

## Allocate

利用 desc 创建一个 Runtime Job 存储进 Job Storage 中, 此处比较好的锁的使用 ——

```C++
uint32_t index = JobHandle::InvalidIndex;
{
	std::lock_guard lock(m_freeMutex);
	if (m_freeIndices.empty())
	return JobHandle::Invalid();
	index = m_freeIndices.back();
	m_freeIndices.pop_back();
}
```

在获取到空插槽的 index 的时候, 我们使用了一个小的作用域来进行访问, 这样就可以让 `freeMutex` 的锁占用时间比较短, 同时不和之后的 `slot.mutex` 进行作用域重叠, 就可以避免形成复杂的多锁顺序, 减少出错吧(比如死锁之类的)

当然, 我们也可以使用 `std::scoped_lock` 来实现, 但是这其实不是很符合逻辑, 因为 `Allocate` 实际上是两个逻辑操作的顺序执行 —— 一是得到空槽位, 二是创建数据存入. 所以确乎是现在的实现不赖

此处也有一个细节, 就是在传递 Callable 的时候 `slot.function = std::move(desc.function)`, 结合一下之前说的 SmallJobSystem 的时候, 它是一个 Move-Only 的数据结构, 构造成本比较稳定, 而且没有额外的 Heap Allocation 的消耗 (对于比较大的数据来说, `std::function<>` 是有可能触发的, 而 SmallJobFunction 保证了就是 128B 的数据)

在自己的 M4 Mac Air 上做了一个小 Benchmark (跑了 65,536 个任务的代表结果)

| 场景                 | SmallJobFunction | std::function | 结果                       |
| ------------------ | ---------------- | ------------- | ------------------------ |
| 小 capture：构造+执行+销毁 | 321 μs           | 238 μs        | std::function 快约 1.35×   |
| 大 capture：构造+执行+销毁 | 511 μs           | 2,357 μs      | SmallJobFunction 快约 4.6× |
| 大 capture：仅执行      | 81.8 μs          | 82.3 μs       | 基本相同                     |
| 大 capture：移动赋值生命周期 | 375 μs           | 4,482 μs      | SmallJobFunction 快约 12×  |
| 大 capture：构造分配     | 0 次/任务           | 1 次、104 B/任务  | SmallJobFunction 消除分配    |

可以看出来效率很高 a, 尤其是在 `std::function` 触发 Heap Allocation 的时候

接着再看其中的 memory_order 的设计, 对于普通的什么 `remainingDependencies` `unfinishedWork` 等都是使用 `relaxed`, 而 `state` 却是 `release`

那么也就是说, 上面那些变量其实只是正常的初始化而已, 自己之间并没有强烈的什么同步关系. 但是 `state` 却被认作是Slot 已经初始化完成的发布点. 也就是当其他线程执行 `slot.state.load(std::memory_order_acquire);` 并且读取到 `Created` 的话, 可以证明当前的 Slot 是在 Storage 层是初始化完成的了. (之后注册 dependency 之类的后面再说, 至少说完成了基础的初始化)


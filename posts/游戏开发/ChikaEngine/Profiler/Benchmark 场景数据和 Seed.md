---
tags:
  - ChikaEngine
  - 游戏引擎
  - 性能分析
---

# Benchmark 场景数据和 Seed

先生成一份纯数据的场景描述，然后丢给下一步的工厂`BenchmarkSceneFactory`进行实例化，构建真实的场景

此处详细说明一下从CLI传来的Scene 和 Seed 中如何生成一套BenchmarkSceneLayout，同时顺带说说随机种子的事情

## 生成逻辑

### 函数签名

先看函数签名`BenchmarkSceneLayout GenerateBenchmarkSceneLayout(BenchmarkSceneId scene, uint32_t seed);`

得知,传入的确乎是只有

- `Scene ID` —— 决定生成什么类型的 workload
- `seed` —— 决定可复现的扰动

然后返回值是一个 `BenchmarkSceneLayout`类型,

```C++
struct BenchmarkSceneLayout
{
	BenchmarkSceneId scene = BenchmarkSceneId::Empty;
	uint32_t seed = 0;
	std::vector<BenchmarkObjectSpec> objects;
	uint64_t stableHash = 0;
	float worldRadius = 10.0f;
};
```

这实际上是一个纯数据类,会把后期传入工厂所需要的物体信息/世界信息等存储

### 初始化

`ObjectCount` 使用 `switch` 把公开场景枚举映射成固定对象数,这样workload档位就比较明确.

### 物体计算

```C++
const uint32_t side = count == 0 ? 1 : static_cast<uint32_t>(std::ceil(std::sqrt(static_cast<double>(count))));

constexpr float spacing = 2.25f;

const float halfExtent = static_cast<float>(side - 1) * spacing * 0.5f;
layout.worldRadius = std::max(10.0f, halfExtent * 1.5f);
```

也就是说,要放置`count`个对象,就需要找到一个`side * side` 的网格来容纳,同时保证物体之间的间隙是`2.25f`

这样做的好处 ——

- spacing 可控
- 世界尺寸可控
- 可视范围可控
- 测试结果稳定

最后在循环放置物品的时候,就可以方便的把下标映射到网格坐标

```C++
const uint32_t row = index / side;
const uint32_t column = index % side;
```

同时此处计算坐标使用 ——

```C++
object.position = {
	static_cast<float>(column) * spacing - halfExtent,
	0.0f,
	static_cast<float>(row) * spacing - halfExtent
};
```

也就是说它会围绕原点`(0, 0, 0)`进行排列,而不是从原点开始排列,这样数据分布也更合理,同时相机的规则也更简单

#### Dynamic

动态物体的生成也有点意思,我们在生成数据的时候其实也只需要记录`dynamicPhase`即可,然后在Update的时候进行更新,它是“帧稳定”的,先看代码 ——

```C++
Math::Vector3 ComputeDynamicPosition(const BenchmarkObjectSpec& object, uint64_t simulationFrame)
{
	const float time = static_cast<float>(simulationFrame) * (1.0f / 60.0f);
	Math::Vector3 position = object.position;
	position.y += 0.75f * std::sin(time * 1.7f + object.dynamicPhase);
	return position;
}
```

由于传入的是绝对 `simulation frame`，也就是模拟帧编号,所以先映射成为时间,然后再用“随机扰动”进行位置的更新

### dynamicPhase

伪随机是这样的,用一个比较基础的线性同余生成器来进行可复现的随机数生成

方程为

$$
X_{n+1} = (a * X_{n} + c) \mod m
$$
此处我们取参数

$$
a = 1664525, c = 1013904223,m = 2^{32}
$$

就得到 ——

```C++
randomState = randomState * 1664525u + 1013904223u;
object.dynamicPhase = static_cast<float>(randomState & 0xffffu) * (6.28318530718f / 65535.0f);
```

其中第一项就是传入的 `seed`,其默认值为`0xC41CAu`, 并且当传入0的时候会转成`0x9e3779b9u`

在计算`randomState`的时候利用无符号整形的自然溢出,所以不使用取模运算;

接着算 `dynamicPhase` 时,我们仅取其低 16 位(`& 0xffffu`) 最后映射成角度$[0, 2π]$

### 其他数据

还引入了 mesh 和 material 的不同组合,这样同时也可以给渲染一点压力(比如说在大量的物体没经过pipeline排序的时候效率比较低,用了排序之后效率提升等,就可以从此处看出)

### 稳定哈希

用于判断这次 benchmark 的场景配置到底是不是同一个 workload —— 这是我们用于判断同一个场景下的benchmark结果是否可以比较的条件

如果哈希值是一致的,则说明benchmark结果可进行对比;
如果不一致,说明跑在不是用一个场景下,则结果不可直接进行对比

当然,这只是必要条件,在真实对比的时候,还要保证 schemaVersion、Build、GPU、configuration 等条件也一致

这样才保证“公平性”

## 随机数种子

随机数生成实际上是一个数学推导出来的序列,而种子就是首项.所以同一个算法，同一个 seed，同样的调用顺序，会产生同样的序列.这样保证了可复现性.

具体使用,比如房间生成,地形生成或者其他什么,继续挖坑(
---
tags:
  - ChikaEngine
  - 实时渲染
  - Shader 与材质
---

# Shader Interface Stable Hash

浅说一下 ChikaEngine 中的 Stable Hash 设计。

它不是为了把字符串变成数字这么简单，而是为了给数据提供一个稳定的“内容身份”，在此处对应了

- Shader Reflection
- Program Interface
- Vulkan Layout Cache 
- Benchmark Layout

简单来说，稳定哈希干的事情是——对结构化数据进行稳定排序、显式字段编码之后得到的 uint64_t 身份。

## Why

一言以蔽之，需要哈希的，是那些会影响缓存/需要进行**复用**的判断的数据 —— 

多说一点 —— 当我们使用一份数据去生成另一份东西的时候，值得考虑使用稳定哈希，它可以解决“旧的生成结果是否可以继续使用”

比如

```
SPIR-V
	-> Reflection Data
	-> reflection sidecar
Shader Reflection
	-> Program Interface
	-> Pipeline Layout
Descriptor Binding
	-> VkDescriptorSetLayout
Benchmark Options
	-> Benchmark Scene Layout
	-> Benchmark Result
```

在这样的数据流下，输入的数据有没有变？-> 因为输入改变之后就设计重新生成新数据的事，而如果没变则可以一直复用旧的生成结果

所以此处使用稳定哈希来判断输入数据是否有改变

## 核心设计

### 1. Normalization

目的是不依赖反射顺序，只要成员是一致的，就应当是同一个类，比如

```C++
resource = {light, material};
resource = {material, light};
```

两个资源只是枚举顺序不同，那么它们应当代表同一个接口结果，所以先对所有字段进行一个排序

```C++
void NormalizeBufferLayout(ShaderBufferLayout& layout)
{
	std::ranges::sort(layout.members, {}, [](const ShaderBufferMember& member)
		{ 
			return std::tuple(member.offset, member.name); 
		}
	);
}
```

### 2. Hash编码

比如说对于 `BufferLayout`

```C++
void HashBufferLayout(uint64_t& hash, const ShaderBufferLayout& layout)
{
	HashString(hash, layout.name);
	HashValue(hash, layout.size);
	HashValue(hash, static_cast<uint64_t>(layout.members.size()));
	for (const auto& member : layout.members)
	{
		HashString(hash, member.name);
		HashValue(hash, member.type);
		HashValue(hash, member.offset);
		HashValue(hash, member.size);
		HashValue(hash, member.arrayCount);
		HashValue(hash, member.arrayStride);
		HashValue(hash, member.matrixStride);
	}
}
```
此处就硬编码掉 `layout`中的所有字段，保证了一致性，其中Hash算法使用的是比较容易实现的稳定 FNV-1a Hash（至于具体怎么做，以及其他的稳定哈希算法，继续挖坑等以后填写）

## 需要哈希的数据

### ShaderReflectionData

它是单个 Shader Stage 的反射结果，对应一个持久化产物`xxx.spv.reflection.json`，那么在保存`sidecar`的时候，顺带把哈希结果写入

然后在加载`sidecar`的时候，让引擎重新计算一次哈希结果，如果对的上，则说明`sidecar`是对的，如果对不上，则可能发生 ——

- shader 改了
- sidecar 没更新 
- sidecar 被手动改坏 
- reflection 格式变了

或者其他什么问题，需要重新做 shader 反射，所以在此处利用稳定哈希来判断 shader 暴露给引擎使用的接口数据有没有变

### ShaderBufferMember / ShaderBufferLayout

`member` 描述了 buffer 成员的真实内存布局，比如offset等，如果变了，则会影响 Material 写 GPU buffer 的方式；否则 shader 里的 UBO 布局明明变了，但引擎还以为旧 reflection 可以继续用，就会出现非常神奇的渲染错误（~~别说了，全局乱飘的三角形~~

这样在对member哈希的时候，可以让上层layout也捕获到变化

### ShaderProgramInterface

`ShaderReflectionData` 只是单个 stage，然后`ShaderProgramInterface`是多个 stage 合并后可以表示一整套Shader Program的一个结果，它需要 hash，因为会影响后续 Pipeline / Layout 的创建和复用

比如说资源布局变化，就可以通过此次的稳定哈希感知

### DescriptorSetLayout

更 Simple 的 —— 它就是 Vulkan 后端缓存 key，引擎根据 shader reflection 得到 descriptor binding 信息，然后创建`VkDecriptorSetLayout`

这样用于避免重复创建相同的`VkDecriptorSetLayout`

### BenchmarkSceneLayout

此处是区分不同的Benchmark跑的场景 —— 假设两次Benchmark跑的场景名称一致，但是如果种子不同、对象位置不同……，那么实际上它们就不是同一个Benchmark，所以使用稳定哈希把它处理之后，以便于回答“这两次 benchmark 是否真的跑在同一个输入布局上？”，从而判断Benchmark的结果是否可以用于比较。

## 综上所述

如果一份数据会生成某种缓存结果， 并且下次想知道旧结果还能不能用， 就可以给这份数据做 stable hash

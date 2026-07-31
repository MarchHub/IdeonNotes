---
tags:
  - ChikaEngine
  - 反射
  - Shader 与材质
---

# Shader 反射

之前为了简单敏捷，Shader 布局是硬编码写死在全局 `Descriptor Set Layout` 中

- binding `0-3` 固定为 Uniform Buffer。
- binding `4-15` 固定为 Combined Image Sampler。

这样拓展性和使用性就非常低，于是引入 Shader 反射，依赖一个比较轻量的第三方库[SPIRV-Reflect](https://github.com/KhronosGroup/SPIRV-Reflect)

## 数据流

### 导入资源

首先导入`vert/frag`源文件进行编译，接着在`ShaderImporter`中先进行反射分析，然后调用一次`ValidateEngineSetConvention`检查是否符合引擎约定的布局

- set 0 保存 frame/scene
- set 1 保存 material
- set 2 保存 object

### 反射分析

调用第三方库进行反射分析 ——

 - Descriptor set、binding、类型、数组长度
  - Uniform/Storage Buffer 大小与成员 offset
  - Push Constant
  - Vertex Input
  - Fragment Output
  - Shader Stage 和 Entry Point

### 持久化

形成`Reflection Sidecar`，把分析结构存储为`*.spv.reflection.json`，作为导入源Shader的最终产物之一，不过不拥有独立的guid/meta，这个依旧是给shader源文件里

### Runtime 使用

在 Runtime 的时候`ShaderData`保存源文件信息和反射信息

```C++
struct ShaderData
{
	std::string path;
	std::vector<uint8_t> spirv;
	Shader::ShaderReflectionData reflection;
	bool hasReflection = false;
};
```

### Stage 合并

经过上一步 Runtime 时候的加载，此时单个 Shader Stage 已经完整包含了SPIR-V 二进制码和反射描述，但是一般来说一个完整的 Pipeline 需要Vert和Frag两个着色器，于是在此步进行合并

此步骤输入Vertex和Fragment的ShaderReflectionData，合并成`ShaderProgramInterface`，同时多包一层`ShaderProgramBuildResult`，进行 success 和 error 信息的打包

```C++
struct ShaderProgramInterface
{
	std::vector<ShaderResourceBinding> resources;
	std::vector<ShaderPushConstantRange> pushConstants;
	std::vector<ShaderVertexInput> vertexInputs;
	std::vector<ShaderFragmentOutput> fragmentOutputs;
	uint64_t stableHash = 0;
	/**
	 * @brief 按稳定 Shader 资源名称查找 Descriptor。
	 */
	const ShaderResourceBinding* FindResource(std::string_view name) const;
	/**
	 * @brief 按资源和成员名称查找 Reflection Buffer Member。
	 */
	const ShaderBufferMember* FindBufferMember(std::string_view resourceName, std::string_view memberName) const;
	bool operator==(const ShaderProgramInterface&) const = default;
};
```

### Resource 层

这层的用途不变，CPU 到 GPU 侧数据的适配器 —— 

Material 中的参数，offset 也通过反射记录，而不是之前手动对齐 ——

```C++
 struct ShaderBufferMember
{
	std::string name;
	ShaderValueType type = ShaderValueType::Unknown;
	uint32_t offset = 0;
	uint32_t size = 0;
	uint32_t arrayCount = 1;
	uint32_t arrayStride = 0;
	uint32_t matrixStride = 0;
	bool operator==(const ShaderBufferMember&) const = default;
};
```

在创建 pipeline 的时候也把反射信息传递给 RHI 后端 ( `PipelineDesc` 中记录`ShaderProgramInterface` ) 构建完整

- VkDescriptorSetLayoutBinding 描述结构
- VkDescriptorSetLayout Vulkan 对象
- VkPushConstantRange 描述结构
- VkPipelineLayout Vulkan 对象
- VkGraphicsPipeline

（使用 Vulkan 作为例子）

此外 ——

- 缓存 Descriptor Set Layout。
- 缓存 Pipeline Layout。
- 根据 Reflection 校验 Descriptor 写入类型和数组下标。
- 根据 Reflection 校验 Fragment Output 与 Attachment。
- 在创建阶段将资源名称解析为 ResourceBindingHandle，避免逐 Draw 搜索字符串。
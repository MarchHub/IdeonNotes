# Descriptor相关

先大体浏览一下流程 —— 

```
Shader 声明资源 (set/binding)
↓
DescriptorSetLayout（根据 shader 创建）
↓
PipelineLayout（组合多个 SetLayout）
↓
Pipeline（创建时绑定 PipelineLayout）
↓
创建 Buffer / Image（分配显存）
↓
DescriptorSet（从 Pool 分配）
↓
WriteDescriptorSet（把 Buffer/Image 写入 Set）
↓
CommandBuffer:
    vkCmdBindPipeline
    vkCmdBindDescriptorSets
    vkCmdDraw
```

## Descriptor

对于各种 shader 中资源的一种描述符，比如描述这是`uniform`还是`Texture sampler`或是其他资源等。

这是一个通用接口（==抽象==概念，用于匹配所有的资源类型）

> [!note]
> Descriptor 是“资源槽位类型”，不包含数据


## Descriptor Set Layout

从名字就可以得知，首先 `Descriptor Set` 就是各种 `Descriptor` 的集合，来整合描述符。接着 `Layout` 表明了这是它会说明清楚所有的资源是如何布局的 —— 比如 binding 0 是什么，对应什么资源；binding 1 是什么 Descriptor 诸如此类。

也就相当于一个资源的蓝图，完整的描述了各种资源和参数是如何运用进 Shader 之中的

## Descriptor Set

从 Descriptor Pool 分配的对象，绑定实际资源

## Write Descriptor Set

真实的写入的操作，需要 `VkDescriptorBufferInfo`（用于绑定 Buffer，也就是存储真实数据的 Buffer）—— 整合一整个 DescriptorSet （资源蓝图）和真实的数据（VkDescriptorBufferInfo）

接着通过 `vkUpdateDescriptorSets` 把数据写入 device 中

然后把 CPU 数据拷贝到 Buffer 中，最后在录制指令的时候绑定`vkCmdBindDescriptorSets`，通知GPU绘制的时候需要读取这个 Set 中的内容




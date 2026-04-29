# Pipeline

简述一下 Vulkan Pipeline的相关内容。（其实耐下心看手册大部分还是比较容易懂的，只是东西比较多而且长，看起来比较繁琐。

## Create Info

先看一下如何定义
```C++
// Provided by VK_VERSION_1_0
typedef struct VkGraphicsPipelineCreateInfo {
    VkStructureType                                  sType;
    const void*                                      pNext;
    VkPipelineCreateFlags                            flags;
    uint32_t                                         stageCount;
    const VkPipelineShaderStageCreateInfo*           pStages;
    const VkPipelineVertexInputStateCreateInfo*      pVertexInputState;
    const VkPipelineInputAssemblyStateCreateInfo*    pInputAssemblyState;
    const VkPipelineTessellationStateCreateInfo*     pTessellationState;
    const VkPipelineViewportStateCreateInfo*         pViewportState;
    const VkPipelineRasterizationStateCreateInfo*    pRasterizationState;
    const VkPipelineMultisampleStateCreateInfo*      pMultisampleState;
    const VkPipelineDepthStencilStateCreateInfo*     pDepthStencilState;
    const VkPipelineColorBlendStateCreateInfo*       pColorBlendState;
    const VkPipelineDynamicStateCreateInfo*          pDynamicState;
    VkPipelineLayout                                 layout;
    VkRenderPass                                     renderPass;
    uint32_t                                         subpass;
    VkPipeline                                       basePipelineHandle;
    int32_t                                          basePipelineIndex;
} VkGraphicsPipelineCreateInfo;
```

`ShaderStage` 用于描述 Shader, 加载的 Vertex Shader 和 Fragment Shader 就放在其中。
`ViewPort` 缩放
`Rasterization` 光栅化前的一些操作
`ColorBlend` 描述色彩混合
`VertexInputState` 指定顶点数据，以及如何输入（是
```
{1, 2, 3, 4, 5, 6}
```
还是
```
{{1, 2, 3}, {4, 5, 6}}
```
类似这样
`InputAssemblyState` 顶点数据如何组织（比如独立的点，三角形，三个点怎么组成一个三角形……

## 其他

如果需要动态的在运行时调整一些GPU状态——比如动态设置 viewport，动态剔除模式等，也提供了`VkDynamicState`来在 pipeline 创建的时候进行声明，这样在渲染的时候可以通过`CommandBuffer`中利用一些提供的方法，如`vkCmdSetViewport`等来进行动态调整。

其他的数据，比如 MVP 矩阵，光照方向之类的，属于动态资源数据，可以通过 `DescriptorSet` 或者 `vkCmdPushConstants` 来进行设置 （ 后面单独讨论）

最简 Pipeline 说明，主要就是静态的描述GPU侧应当如何进行渲染，告诉它一个渲染流程。对于动态资源等，会在其他笔记中说明清楚。


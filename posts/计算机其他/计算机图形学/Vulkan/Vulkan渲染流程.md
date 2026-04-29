# Vulkan 渲染流程

简单说明一下Vulkan的渲染流程，不涉及太具体的使用。

## 初始化

### 全局和设备

`VkInstance`，创建一个实例，包含应用的名字、版本、使用的VulkanAPI版本等；同时指定要启用的**Instance 扩展**和验证层。==之后所有的Vulkan对象都是依赖它的==

`VkPhjysicsDevice`，物理设备（GPU），先通过 `vkEnumeratePhysicalDevices` 查询主机上的 GPU。然后可以根据评分策略来选择合适的物理设备

`VkDevice`，在选定的 `VkPhysicalDevice` 上创建。需要指定要启用的 Device 拓展以及要创建哪些 queue family 的 queue，和每个 queue 的数量和优先级

`VkQueue` 队列按功能可以分为：

- Graphics queue：提交绘制命令。
- Compute queue：提交计算任务。
- Transfer queue：提交数据传输任务。
- Present queue：提交呈现任务（把 image 显示到屏幕）。

### 窗口和呈现

`VkSurfaceKHR`，窗口表面，由窗口系统（GLFW/Win32/X11 以及其他）创建。作用是沟通了Vulkan和OS的窗口，（如果离屏渲染就不需要这个）。

同时，它和物理设备共同决定这个 GPU 是否支持在该 surface 上呈现，以及支持哪些 surface format、present mode 等

`VkSwapchainKHR`，交换链，基于 `VkDevice` + `VkSurfaceKHR` 创建。本质上是一组可以被 present 出来的 `VkImage` 管理器。一些关键参数 ——

- `minImageCount`：交换链中 image 的数量（通常 2 或 3）。
- `imageFormat` / `colorSpace`：颜色格式。
- `imageExtent`：分辨率（通常等于窗口大小）。
- `presentMode`：呈现模式（FIFO / MAILBOX / IMMEDIATE 等）。

它的运行逻辑是在每一帧的时候用 `vkAcquireNextImageKHR` 从 swapchain 拿一张 image，接着渲染到这张 image 上，最后用 `vkQueuePresentKHR` 把它呈现到屏幕。

### 渲染配置

`VkPipeline`，用来描述GPU侧的渲染流程，大致为——

- Shader 阶段（vertex / fragment / optional others）。    
- 顶点输入布局（vertex buffer 的格式）。
- 图元装配（点/线/三角形）。
- 光栅化设置（填充/线框、背面剔除、正面朝向）。
- 多重采样（MSAA）。
- 颜色混合（blending）。
- 深度/模板测试（如果有）。

值得注意，pipeline 一旦创建后不可修改，只能重新创建新的 pipeline。

更值得注意，因为它只是单纯的描述GPU侧的行为，所以Pipeline 必须与某个 RenderPass 的某个 Subpass 匹配，**否则 pipeline 无法使用**

`VkRenderPass`，用于描述渲染过程，pipeline 只是告诉 GPU 要怎么流水线式的工作，还需要一层用于描述完整渲染流程的工作 ——
    
- 使用哪些 attachment（color / depth / stencil）。
- 每个 attachment 的 load/store 行为（清空、保留、丢弃）。
- attachment 的初始布局和最终布局。
- subpass 之间的依赖关系。

可以简单理解为「这次渲染要怎么用这些图像资源」的高层脚本。

`VkFramebuffer` 具体的渲染目标实例

- 和 `VkRenderPass` 配合使用。
- 把一组具体的 `VkImageView` 绑定到 render pass 的 attachment 上。
- 对于 swapchain：
    - 通常是「每个 swapchain image 对应一个 framebuffer」。

即告诉本次渲染具体需要渲染到哪几张图上。

### 命令和同步

`VkCommandBuffer`，用来录制具体的 GPU 命令 ——

- 开始 render pass
- 绑定 pipeline
- 绑定 vertex buffer
- 发出 draw call 等。

录制完成后，通过 `vkQueueSubmit` 提交到某个 `VkQueue` 执行。

CommandBuffer 本身不执行任何操作，它只是一个“命令列表”。只有提交到 Queue 后才会被 GPU 执行

`VkCommandPool`，和某一个 Queue Family 绑定，用于分配 `VkCommandBuffer`，提升效率

异步的提交一定涉及到同步数据的问题 ——

- `VkSemaphore` 信号量
	- 用于 GPU-GPU 或 GPU-present 之间的同步。
	- 常见用法：
		- `imageAvailableSemaphore`：image 可用 → 才能开始渲染。
		- `renderFinishedSemaphore`：渲染完成 → 才能呈现。
- `VkFence` 栅栏
    - 用于 GPU-CPU 同步。
    - 常见用法：        
        - CPU 等待某一帧的 GPU 提交完成，再重用对应的资源（command buffer、同步对象等）。
## 资源对象

`VkBuffer`，所有线性数据都存放在里面—— 顶点、索引、uniform、storage 等
`VkImage`：二维/三维图像数据（颜色贴图、深度贴图、G-buffer 等）。

但是需要注意，在`VkBuffer`和`VkImage`创建的时候并不会自动绑定内存，后面需要手动显式的分配/绑定

`VkDescriptorSet` （以及其他描述表）
- `VkDescriptorSetLayout`：描述 shader 可见的资源布局：
    - 第几个 binding 是 uniform buffer？
    - 第几个 binding 是 sampled image？        
- `VkDescriptorPool`：用来分配 descriptor set 的池。
- `VkDescriptorSet`：具体的一组绑定：
    - 把某个 uniform buffer / image view / sampler 绑定到某个 binding 上。
- 作用：
    - 在 draw call 前，通过 `vkCmdBindDescriptorSets` 把这些资源绑定给 pipeline 使用。
可以理解为：**「告诉 shader：你要的数据在哪」的描述表**，单独设计这一层的原因是 Vulkan 不允许 shader 直接访问资源，必须通过 DescriptorSet 显式绑定资源，使得资源访问完全可追踪、可验证、可同步。

## 组装到一起

先初始化Instance和各个设备、模块；

然后是渲染过程——
1. CPU等待上一帧的 `VkFence`
2. `vkAcquireNextImageKHR` 从 swapchain 获取一张 image，signal `imageAvailableSemaphore`
3. 重置并录制 `VkCommandBuffer`：
	- `vkCmdBeginRenderPass`（指定 render pass + framebuffer + clear color）。
	- `vkCmdBindPipeline`。
	- 绑定 vertex buffer / descriptor set（如果有）。
	- `vkCmdDraw`。
	- `vkCmdEndRenderPass`。
4. 提交命令
	- 等待 `imageAvailableSemaphore`。
    - 执行 command buffer。
	- signal `renderFinishedSemaphore` + `inFlightFence`。
5. 展示图片
	- 等待 `renderFinishedSemaphore`。
	- 把对应的 swapchain image 呈现到屏幕。

不过一定要注意，这里 CPU/GPU、GPU/GPU、GPU/Present 之间的所有依赖是需要我们手动指定的，否则会产生数据竞争或未定义行为。

最后清理

![Pasted image 20260312134308](Assets/Pasted%20image%2020260312134308.png)


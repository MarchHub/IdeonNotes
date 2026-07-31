---
tags:
  - ChikaEngine
  - 游戏引擎
  - 实时渲染
---

# 窗口Resize解决方案

## GLFW

先简单说下什么是 GLFW —— 它用于

- 窗口管理
- 处理用户输入

特点：轻量、跨平台

## Vulkan

一个跨平台的渲染API而已，它并不知道Win下的HWND，或者是Linux的XCB等窗口句柄，通过Surface这个抽象来做全部的适配。

也就是说，GLFW 屏蔽了所有 OS 细节（比如在Win下申请HWND等，），直接根据平台创建好Surface，然后递给Vulkan一个干净的 `VkSurfaceKHR`。对 Vulkan 来说，它并不需要理财这是什么系统的窗口，只需要知道这是一个可以把图像塞进去的合法目标即可

同时，Swapchain 的尺寸必须的和 Surface 的尺寸一致，这样才可以做到多缓冲的呈现图片

## 问题

假设 GLFW 进行了窗口的 Resize 操作，但是不对原先 Vulkan 的渲染逻辑进行任何更改 ——

1. 系统通知 GLFW 的窗口被 Resize 到了新的宽度和高度
2. Surface 发生改变，但是 Swapchain 上依旧是旧的大小
3. Vulkan 依旧向 Swapchain 索要画布，同时在旧的大小上绘制好所有内容
4. Vulkan 绘制好后把尺寸不匹配的图片强行塞进新的 Surface 中
5. 显示驱动对比尺寸后发现二者不对应，为了防止越界访问显存，驱动直接抛出 `VK_ERROR_OUT_OF_DATE_KHR`，程序崩溃

## 解决方案

所以在遇到 Window Resize 的时候需要重建 Swapchain，具体操作 ——

1. 通过`vkDeviceWaitIdle`等待所有队列里的任务执行完毕，这样使得所有资源没有被占用，可以随意销毁创建等
2. 把旧的 Swapchain 销毁，同时把基于旧 Image 创建的 Framebuffer 和 ImageView 也全部销毁
3. 利用新的尺寸重新创建一个新的 Swapchain，重新申请新的显存图片
4. 继续进行渲染等操作

## View Resize 方案

和 Window Resize 相比简单许多，因为只是 Image 发生了大小变化。

这次引擎使用了 Imgui 来制作一个简单的 ViewPortPanel。

先简单说下投放流程 ——

- Renderer 离屏渲染出一个纹理，放在一个 Framebuffer 中
- 通过 Imgui 提供的方法`ImGui_ImplVulkan_AddTexture`把离屏渲染的图像注册到 Imgui 中（返回一个指向 Vulkan Descriptor Set 的指针实际上
- 最后在Imgui中通过`ImGui::Image()`绘制

那么在ViewPort Resize的时候，只需要通知 Renderer 动态重建离屏渲染目标即可（按照目标大小来Resize，不会出现画面的拉伸等），同时更新相机的 AspectRatio

踩坑点 —— 如果在 GPU 还在处理旧的图片的时候直接进行离屏目标的销毁和新建，会爆。所以需要等待 GPU 空闲的时候再进行离屏的 Framebuffer 的销毁与重建



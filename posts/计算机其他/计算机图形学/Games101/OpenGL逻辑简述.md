---
tags:
  - CG
  - GraphicsPipeline
---

# OpenGL 逻辑简述

以 OpenGL 的 API 作为例子简述一下传统的渲染管线

OpenGL 的 API 作为例子 ——
```C++
// 创建缓存区
GLuint vbo;
glGenBuffers(1, &vbo);

// 绑定缓存区
glBindBuffer(GL_ARRAY_BUFFER, vbo);

// 开始往 GPU 中传输数据
glBufferData(GL_ARRAY_BUFFER, size, data, GL_STATIC_DRAW);
```
在 `glBufferData` 执行的时候, 数据就从 CPU 上顺着主板上的 PCIe 通道，**轰入**显卡的显存中
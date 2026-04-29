# Attachment

对图像资源的描述——我们怎么在一个 pass 中使用它，比如一张图片是什么format, 渲染开始和结束的行为是什么，布局等

描述 ——

- format：图像格式
- samples：MSAA 采样数
- loadOp：渲染开始时如何处理旧内容（CLEAR / LOAD / DONT_CARE）
- storeOp：渲染结束后如何处理结果（STORE / DONT_CARE）
- initialLayout：渲染开始前的布局
- finalLayout：渲染结束后的布局


# UV 坐标

把模型表面映射到平面的二维纹理坐标上的一种方式。

在空间上可以想象成那剪刀沿着缝把模型剪开然后铺平摊开放在桌上模型表面上的点就可以拥有二维坐标，也就是 UV。

其中

- U 横向坐标
- V 纵向坐标

UV 本身不是贴图，也不是颜色。

它更像是模型表面上的一个二维地址。

## 计算

基本上一个顶点都会带有其uv信息，然后在 GPU 光栅化三角形时，会在三角形内部插值出每个 fragment 的 UV

$$
uv = λ_0 * uv_0 + λ_1 * uv_1 + λ_2 * uv_2
$$

其中

$$
λ_0 + λ_1 + λ_2 = 1
$$

 $λ_0$、$λ_1$、$λ_2$ 是当前 fragment 在三角形中的重心坐标。不过真实 GPU 中会做透视校正插值，不是简单的线性插值，否则贴图在透视情况下会产生明显变形

## 范围限制

常见的，uv 会被限制到$[0, 1]$中，不过实际上比较灵活，可以超出 —— 此处超出的部分有几个比较常见的模式

- Repeat：重复，超出部分循环
- Clamp：夹住边缘，`uv = clamp(uv, 0.0, 1.0);`
- Mirror：镜像重复 —— 正向、反向、正向……

（此处得看 Sampler / Texture Address Mode 的行为）

## 使用

最基础的，可以在Fragment Shader中使用

```GLSL
vec4 value = texture(uTexture, uv);
```

其中`uTexture`是被采样的图片，所以这个 value 代表 —— “把模型通过 uv 坐标映射到 texture 上并且取走对应坐标的值”

常见的，我们可以控制其

- Tiling —— 控制“重复”（实际上是对 uv 坐标进行放缩，然后看 Sampler 的行为定义，是repeat、clamp 还是 mirror
- Offset —— 控制偏移

一个基础的 GLSL
```
vec2 finalUV = uv * tiling + offset;
vec4 value = texture(uTexture, finalUV);
```

那么具体在渲染引擎中的使用就待到具体说明罢

# Mipmap

经典的空间换时间的算法,提前计算好数值然后进行一个存储

## 提出问题

想象一下，我们对一个比较远的物体在进行贴图的时候，屏幕 pixel 移动到相邻的 pixel 时，插值得到的 uv 可能就会发生大变(, 对应那个模型的 texel 就会移动非常远的距离。那么再假设这个物体稍微移动一点或者模型比较占地方(动态和静态)，那么这个抖动就会非常怪异（比如闪烁，摩尔纹等）。此时就可以通过引入 mipmap —— 其实也就是说，一个 pixel 对应了大量的 texel，那么此时我们需要怎么采样才能使得画面好看？—— 那么一个很显然的方法就是对覆盖区域求均值

$$
C_{\text{pixel}}
\approx
\frac{1}{|\Omega_{\text{pixel}}|}
\int_{\Omega_{\text{pixel}}}
T(u,v)\,du\,dv
$$

值得注意的是，mipmap 仅是针对纹理缩小提出的优化方法，即一个 pixel 覆盖了多个 texel 的情况

对于纹理放大，可以使用

- Nearest；
- Bilinear；
- Bicubic；
- 超分辨率等方法

（不妨继续挖坑）

## Mipmap

其实也非常的简单粗暴，就是不断把原 Texture 的尺寸”砍半“

比如 1024 × 1024 -> 512 × 512 -> 256 × 256 诸如此类,一直到 1 × 1 点时候,我们把这所有生成的 Texture 称之为 Mipmap Chain

先说说计算

新的一层的 Texture 中,存储的是上一级对应 `2 × 2` texel 的平均值,或许可以理解成一个 `Pooling` 层,更高级的 Mipmap 中或许也会使用其他的滤波器,比如 ——

- Gaussian；
- Lanczos；
- Kaiser；
- Mitchell；
- 自定义锐化滤波器

GPU 定位要使用哪一层 Mipmap 也挺有意思 ——

首先有一个直观体验和感受,即 —— 如果两个屏幕像素对应的 uv 变化很慢,那么说明一个像素只是跨过了很少的纹理texel,那么使用高分辨率(低层)的 mipmap 比较合适;同理如果 uv 变化快则说明一个像素会对应很多的 texel,所以需要使用低分辨率(高层)的 mipmap

有了这个直观感受之后,我们上点数学说明 —— 首先我们知道存在一个映射关系就是屏幕坐标(x,y)到纹理坐标(u,v)

$$
f:(x,y)->(u,v)
$$
接着在 GPU 渲染的时候一般会对一个 2 × 2 像素的小组执行 shader,所以此时就可以得到纹理坐标 (u, v) 相对于屏幕像素坐标 (x, y) 的偏导数

也就是说,当x向右边偏移一个 pixel 的时候,可以有

$$
\frac{\partial (u,v)}{\partial x}
=
\left(
\frac{\partial u}{\partial x},
\frac{\partial v}{\partial x}
\right)
$$

同理,当y向上偏移一个 pixel 的时候,有

$$
\frac{\partial (u,v)}{\partial y}
=
\left(
\frac{\partial u}{\partial y},
\frac{\partial v}{\partial y}
\right)
$$

那么有了偏导数,我们就可以显然算出“跨度”大小

$$
L_x=
\sqrt{
\left(W\frac{\partial u}{\partial x}\right)^2+
\left(H\frac{\partial v}{\partial x}\right)^2
}
$$
$$
L_y=
\sqrt{
\left(W\frac{\partial u}{\partial y}\right)^2+
\left(H\frac{\partial v}{\partial y}\right)^2
}
$$

接着我们取其中较大值

$$
L=\max(L_x,L_y)
$$

最终层数就是 ——

$$
\boxed{D=\log_2\left(\max(L_x,L_y)\right)}
$$

### 为什么取最大值

假设横向跨度为2,纵向跨度为16,那么如果我们取$log_2(2)=1$ 第一层的话,那么 Mip 1 只能充分过滤大约两个 texel 的尺度，无法过滤纵向的 16 个 texel，因此仍然可能产生混叠

### 遇到小数

如果 D 取得小数的话,可以简单的向下取整,也可以在两层之间做一次线性插值

## 重新解释

Mipmap 第 D 层上的一个 texel 可以表示原图**单方向** $2^D$ 个 texel

然后 L 表示 当前 pixel 在纹理中的覆盖尺度

所以我们希望二者尽可能相等,于是有

$$
2^D\approx L
$$

然后带入求解

## 问题

首先最容易想到的就是我们在取 L 的时候是使用 max 来取,这种方法能够完成普通 Mipmap 的层级选择，但还有两个问题 ——

- pixel 映射到纹理空间后的覆盖区域不一定是正方形；
- Texture 的宽度和高度不一定相等

比如说在平行法线方向观察一个平面的时候,它可能是 4 × 4 texels,但是带有倾斜角观察的时候可能会变成一个2 × 32 texels 的块, 此处就是各向异性的体现

我们普通的 mipmap 提供的是一个正方形块的近似求解,然而比如在我们为了避免 32 texel 的混叠,那么就会导致 2 texels 那个方向上的信息大量丢失

那么解决办法也比较粗暴,就是我们现在选取跨度小的那个,计算出对应的 Mipmap 层级作为要采样的纹理,然后沿着长轴的方向多次采样最后加权求和得到对于跨度大的那个方向的 texel 近似

## 总结

所以说 Mipmap 本质上就干一件事情 —— 可以快速计算,让我们的一个 pixel 基本上对应一个 texel(采样尺度尽量匹配). 那么在遇到各向异性的问题的时候,就选去小跨度方向对应的 Mipmap 层级,然后对于大跨度方向就使用多次采样取均值的方式获得;遇到小数层级的时候可以使用三线性插值的方式得到一个不错的结果
---
tags:
  - 数学
  - 计算机图形学
  - 几何与光照
---

# Transformation


矩阵乘法理解 —— 
- 代数上，可以看成是方程组的系数抽成矩阵形式
- 几何上，直接把矩阵看成是做了一次==线性变化（基底的变化）==
	- 可以仅通过追踪基底的变化来找到对应的变化矩阵
## Modeling Transformation
### 线性变化


$$x'=ax+by, y'=cx+dy$$
提取成
$$
\begin{bmatrix}
x' \\
y'
\end{bmatrix}
=
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
$$

#### Scale Matrix

$$
\begin{bmatrix}
x' \\
y'
\end{bmatrix}
=
\begin{bmatrix}
s_{x} & 0 \\
0 & s_{y}
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
$$
若 $s_{x} = s_{y} = s$，则表示在二维空间下均匀缩放 $s$ 倍。
若二者不相等，则表示在 $x$、$y$ 轴上分别缩放 $s_x$、$s_y$ 倍。

#### Reflection Matrix

关于 $y$ 轴反射
$$
\begin{bmatrix}
x' \\
y'
\end{bmatrix}
=
\begin{bmatrix}
-1 & 0 \\
0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
$$
理解为，$x$轴方向相反，但是$y$轴不变

#### Shear Matrix

原先的 i, j 不互相垂直

#### Rotation Matrix

（绕原点进行旋转，默认逆时针）

$R_{\theta}$
$$
\begin{bmatrix}
x' \\
y'
\end{bmatrix}
=
\begin{bmatrix}
\cos \theta & -\sin \theta \\
\sin \theta & \cos \theta 
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}$$
### 平移变化

$$
\begin{bmatrix}
x' \\
y'
\end{bmatrix}
=
\begin{bmatrix}
x \\
y
\end{bmatrix}
+
\begin{bmatrix}
t_{x} \\
t_{y}
\end{bmatrix}

$$
### 齐次坐标

把平移和线性变换统一为仿射变换，并用一次矩阵乘法表示。


对于每一个点 $(x, y)$，增加一个维度表示为 $(x, y, 1)$。
对于每一个向量 $(x, y)$，增加一个维度表示为 $(x, y, 0)$。

向量最后一个维度为 $0$，因此不会受到平移分量的影响；点最后一个维度为 $1$，因此会受到平移作用。

推广到一般形式，当 $w \neq 0$ 时，齐次坐标 $(x, y, w)$ 表示欧氏点

$$
\left(\frac{x}{w}, \frac{y}{w}\right),
$$

并且对于任意 $\lambda \neq 0$，$(x,y,w)$ 与 $(\lambda x,\lambda y,\lambda w)$ 表示同一个点。

例如，对于一个点


$$
\begin{bmatrix}
x' \\
y' \\
w'
\end{bmatrix}
=
\begin{bmatrix}
a & b & t_{x} \\
c & d & t_{y} \\
0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
1
\end{bmatrix}
$$
三维齐次坐标系同理

## Viewing Transformation

### 相机

如何确认相机——
- Position —— $\vec{e}$
- LookAt —— $\vec{g}$
- Up —— $\vec{t}$

定义 ——（规避相对运动之类的麻烦，简化模型
- 相机位于$(0, 0, 0)$
- 相机沿着$-z$ 方向看
- 相机向上方向为$y$
- 移动的是Object

### 投影

#### 正交投影（Orthographic Projection）

将对应z轴方向拿掉，就压缩到了(x, y)平面上；再scale到$[-1, 1]$上，就形成了正交投影（最简）

正式做法：
1. 讲锚点移动到原点
2. 缩放成一个单位立方体
所以——得到变化矩阵为（假设锚点在中心）
$$
M_{\mathrm{ortho}} =
\begin{bmatrix}
\frac{2}{r-l} & 0 & 0 & 0 \\
0 & \frac{2}{t-b} & 0 & 0 \\
0 & 0 & \frac{2}{n-f} & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 0 & 0 & -\frac{r+l}{2} \\
0 & 1 & 0 & - \frac{t + b}{2} \\
0 & 0 & 1 & -\frac{n + f}{2} \\
0 & 0 & 0 & 1
\end{bmatrix}
$$



#### 透视投影（Perspective Projection）

把原平面“挤压”成和近平面一样大小，然后做一次正交投影即可

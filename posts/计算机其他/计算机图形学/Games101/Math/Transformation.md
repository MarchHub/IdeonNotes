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
若 $s_{x} = s_{y}$ 则表示均匀在二维空间下缩放 $s$ 倍
不相等，则表示分别在对应轴缩放 $s$ 倍

#### Reflection Matrix

关于$y$轴旋转
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

把平移和线性变化（统称仿射变化）统一成一个矩阵乘法中去


对于每一个点 $(x, y)$，不妨增加一个维度 $(x, y, 0)$
对于每一个向量 $(x, y)$ 不妨增加一个维度 $(x, y, 1)$

关于最后一个维度添加了0或者1，很好的满足了平移不变性等向量特性

推广，对于所有的二维平面下的点，都有$(x, y, w)$ 表示$\left( \frac{x}{w}, \frac{y}{w}, 1\right)$ 其中$w \neq 0$

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
M_{oroth} = 
\begin{bmatrix}
\frac{2}{r-l} & 0 & 0 & 0 \\
0 & \frac{2}{t-b} & 0 & 0 \\
0 & 0 & \frac{2}{n-f} & 0 \\
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

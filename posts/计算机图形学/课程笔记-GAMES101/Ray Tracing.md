---
tags:
  - 计算机图形学
  - 光线追踪
---

# Ray Tracing

光栅化的方法，有很多物理效果难以实现

光：
- 沿直线传播
- 光本身没有碰撞箱
- 光线可逆


## Whitted-Style Ray Tracing

一种递归算法

光线定义：
起点与一个有方向的向量 $r(t)=o + td, 0 \leq t < \infty$

是否相交 —— 
- 隐式表面，直接代入求解
- 显式表面，与三角形求焦
	- 光线和平面求焦
	- 焦点是否在三角形内

表示平面：法向量+一个点P，满足方程：$(P-P')N=0，展开之后——$$ax+by+cz+d=0$ （平面方程

MT 算法

Bounding Voluming：使用包围盒来抽象复杂形状——如果一个光线连包围盒都碰不到，那么更不可能碰到里面的物体

轴对齐包围盒——AABB “横平竖直”

对空间划分 ——
Oct-Tree
KD-Tree
BSP-Tree

对物体进行划分 ——
BVH

## 辐射度量学

准确定义光照的办法

光的属性：
`Radiant Flux` `Intensity` `Irradiance` `Radiance`

- Radiant Flux (Power)：光源单位时间辐射出的能量 $\Phi\equiv\frac{dQ}{dt}$ 是功率，单位 $Watt$ 光学上使用 $lm=lumen$
### Radiant  Intensity

`Radiant Intensity` 简称 `Intensity`，光从光源发出方向性的能量

Power per unit solid angle （每个单位立体角上的Power

$$I(\omega) = \frac{d\Phi}{d\omega}$$
$\Phi$ 可以使用流明或者瓦特作为单位

立体角：单位面积/半径平方 -> $\Omega=\frac{A}{r^2}$ 所以球为 $4\pi$ 立体角

### Irradiance

物体表面接收多少光 Power Per Unit Area （总能量

$$
E(x) = \frac{d\Phi}{dA}
$$
$\left[ \frac{W}{m^2} \right], \left[ \frac{lm}{m^2} =lux \right]$

Power/面积

### Radiance

度量光传播中的能量

某个方向进来，A接收到的能量。所以把所有方向积起来就是`Irradiance`

## BRDF

描述一个微小面积，如何收集一个方向的能量（Radiance）-> Irradiance ，再反射到其他地方去（Radiance）

收集一个方向的能量，按照一定的==比例==再发射出去

$$f_{w}(\omega_{i} \to \omega_{r})=\frac{dL_{r}(\omega)}{dE_{i}(\omega_{i})}=\frac{dL_{r}(\omega _{r})}{L_{i}(\omega_{i})\cos \theta_{i}d\omega_{i}}$$
比如漫反射，就是均等的向各个角度分配能量。

把每一个可能的入射方向对一个出射方向（视角）分配的能量积起来，就是我们看到这个点的光线效果
反射方程：
$$
L_{r}(p, \omega_{r}) = \int_{H^2} f_{r}(p, w_{i}\to \omega_{r})L_{i}(p, \omega_{i})\cos \theta_{i}d\omega_{i}
$$

==渲染方程==：把自己发的光再加上反射方程（自己的光+别人来的光
引用Games101闫神的课件

这就变成一个递归程序

写成 ——
$$
L = E + KL
$$
可以得到
$$
L = (I-K)^{-1}E
$$
然后展开，分解成——
看到光源，光源经过一次反射到达surface，经过两次，经过三次……

---
tags:
  - 计算机图形学
  - 实时渲染
  - 渲染管线
---

# Rasterization Triangle

## Why Triangle

- 三角形是最基础的多边形
	- 所有多边形都可以使用三角形表示
- 一个三角形一定在一个平面内
- 三角形内外定义清晰，并且可以通过向量的叉乘快速判断
- 方便表达

## 光栅化三角形

对屏幕上的每一个像素进行采样，判断其是否在三角形内
```C
for (int x = 0; x < xMas; x++)
	for (int y = 0; y < yMax; y++)
		image[x][y] = IsInside(triangle, x + 0.5, y + 0.5)
```
之所以是 $x+0.5$ 与 $y+0.5$ 是假设像素的大小为 1 且像素中心点在单位正方形的中心

使用`Bounding Box`或者其他Hack简化运算

## 抗锯齿

反走样：先滤波做一次模糊，再进行采样

MSAA：（对反走样进行一个近似）
FXAA
TAA
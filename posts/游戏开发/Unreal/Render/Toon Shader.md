# Toon Shader

对基础光照模型的一个魔改 —— （老演员 Lambert 和 Blinn–Phong

Lambert 连续漫反射
→ Ramp 查表
→ 二段或多段光照

Blinn–Phong 连续高光
→ Threshold
→ 硬边高光

![](toon_shader_sample.png)

## 漫反射阶段

原本来说，我们使用 BaseColor 乘上漫反射强度得到结果，不过 $\vec{N} \cdot \vec{L}$ 是一个连续值，所以此处把它色阶化来取得一个简单的风格化效果，简单来说 ——

$$
C_{toon-diffuse}​=C_{base}​⋅Ramp(N⋅L)
$$

先准备一张由暗到亮但是阶跃的 texture 作为采样的图片，接着把 $N · L$ 作为横坐标，纵坐标为常量进行采样（Clamp 采样方式）

![](toon_shader_ramp.png)

请 G 老师生成了一张简单的示意（仅供参考）

此时就相当于把光照做了个二分 / 多分（看 Ramp Texture 分成几段），而不是连续光照

## 高光

原先的 Blinn-Phong 计算出的结果是连续值

$$
SpecRaw = pow(N\cdot H, SpecPower)
$$

此时把 `SpecRaw` 做判断，大于阈值的设 1， 小于的设 0，最后再乘上高光颜色得到结果 —— 一个没有“微弱高光”过渡的、硬边缘的高光效果。

## UE 相关

毕竟放在 UE 模块下 ——

### 输入节点

| 数据         | UE 节点              |
| ---------- | ------------------ |
| 表面法线 `N`   | `PixelNormalWS`    |
| 人工主光方向 `L` | `Vector Parameter` |
| 观察方向 `V`   | `CameraVectorWS`   |

### 数学节点

| UE 节点        | 对应运算           | 用途                 |
| ------------ | -------------- | ------------------ |
| `Normalize`  | `normalize(v)` | 将方向归一化             |
| `DotProduct` | `dot(a,b)`     | 计算 `N·L` 或 `N·H`   |
| `Saturate`   | `clamp(x,0,1)` | 将结果限制到 `[0,1]`     |
| `Add`        | `a+b`          | 计算 `L+V`           |
| `Power`      | `pow(x,p)`     | 控制高光分布             |
| `Multiply`   | `a*b`          | 应用颜色、强度或 Mask（按位乘） |
| `If`         | 条件比较           | 将连续高光硬切成 0/1       |

除此之外

- `Saturate` 将输入限制在 `[0,1]`，等价于`Clamp(input, 0, 1)`
- `OneMinus` 等价于 `1.0 - input`
- `LinearInterpolate` 线性插值（Lerp）
# UE 材质蓝图

实际上和Unity的ShaderGraph感觉没啥差（

不过还是记录一下。

基础 ——

- Parameter：暴露给外部可修改的参数
- Material Instance：基于爹材质生成的实例
- Material Function：封装函数，打包比较复杂的运算

## 基础设置

- BaseColor
- Roughness
- Matallic

和普通的PBR参数没什么区别（

## UV 相关

### TextureCoordinate

该节点表示模型的 UV, 大概理解成 `layout(location = 0) in vec2 vUV;` 

与此同时，如果不显示指定`Texture Sample`的`UVs`输入，默认使用模型的`UV`

### Transform

基础的UV变化可以写成 `vec2 finalUV = uv * tiling + offset;`

那么可以在材质蓝图中表示成

```
UV ───────────────┐
                Multiply ─── Add ─── Result
Tiling ───────────┘            ↑
Offset ────────────────────────┘
```

有点抽象，但是大体上或许可以理解（

## Texture

普通的 `Texture Sample` 是固定贴图。

如果希望在 `Material Instance` 中替换贴图，需要使用，`Texture Sample Parameter 2D`

可以直接右键普通 `Texture Sample`：

```
Convert to Parameter
```

其中 

- `Texture` 参数表示可以替换的数据源
- `UVs` 输入表示采样坐标
- `RGB` 输出表示采样得到的颜色

## Material Function

封装可复用的材质节点片段

比如 `UV Transform` 这种逻辑：

```
TextureCoordinate
→ Multiply(Tiling)
→ Add(Offset)
```

如果每个材质里都手动复制，会变得很乱。

于是可以封装为

```
MF_UVTransform
```

这样在材质中只需要调用函数

```
TextureCoordinate → MF_UVTransform.UV
Tiling → MF_UVTransform.Tiling
Offset → MF_UVTransform.Offset
MF_UVTransform.Result → Texture Sample UVs
```

可以简单理解 —— 重复的节点逻辑 → Material Function

## Material Instance

把 Parent 暴露出来的参数进行具体赋值，像是一个数据表，而普通的 Material 更偏逻辑


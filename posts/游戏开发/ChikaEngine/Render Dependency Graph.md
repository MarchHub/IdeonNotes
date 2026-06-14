# Render Dependency Graph

浅说一下在 `ChikaEngine` 中实现的 `RDG`

早期版本可以看到，就是反向做了一个可达性剔除，同时保留所有的`SideEffect`节点（简单理解为很重要的，不能被剔除的节点）

重构之后，先说说RDG的Compile过程 ——

## Compile

RDG 的编译过程，就是把 Render Pass 和资源的读写进行一个排序，同时计算其生命周期

可以查阅`RenderGraphl.cpp`在仓库中具体实现，下面简单说说 ——

### Step 01. 清空

首先清空之前的所有状态，比如 Textures / Buffer / Pass/ 上次的编译结果 等

### Step 02. 记录并且检查

先跑一边所有的 pass，记录下依赖关系，以在后面可以跑拓扑排序；同时在遍历的时候进行check，判断图是否合法

#### 核心存储结构

```C++
std::unordered_map<RGTextureHandle, RGPassHandle> lastTextureWriter;
std::unordered_map<RGBufferHandle, RGPassHandle> lastBufferWriter;
std::unordered_map<RGTextureHandle, std::vector<RGPassHandle>> textureReaders;
std::unordered_map<RGBufferHandle, std::vector<RGPassHandle>> bufferReaders;
```

`lastTextureWriter` 记录某个 Texture 最后是由哪个 Pass 写入的
`lastBufferWriter` 同理，但是记录的是 Buffer
`textureReaders` 记录某个 Texture 在上一次写入之后，被哪些 Pass 读过
`bufferReaders` 同理，但是记录的是 Buffer

在遍历的过程中如果遇到非法直接提前返回

### Step 03. Culling

这边就是最早版本的可达性检验的保留，

```C++
for (const RGPassHandle handle : m_passInsertionOrder)
{
    const RGPass* pass = m_passes.Get(handle);
    if (pass && pass->hasSideEffects)
        markLive(handle);
}
```

此处 `markLive` 会递归保留依赖链，然后剔除没有连接到最终输出的 Pass

### Step 04. 拓扑排序生成执行列表

（就是普通的拓扑排序）

在排序的过程中跳过无效的或者被剔除的 Pass，然后如果有环的话也报出来

### Step 05. 生命周期计算

直接看 Texture 生命周期更新

每当当前 Pass 使用一个 Texture，就更新：

```
resource->firstUsePassIdx = std::min(resource->firstUsePassIdx, passIndex);resource->lastUsePassIdx = passIndex;++resource->refCount;
```

含义——

| 字段                | 更新方式 | 含义     |
| ----------------- | ---- | ------ |
| `firstUsePassIdx` | 取最小值 | 第一次使用  |
| `lastUsePassIdx`  | 直接覆盖 | 最后一次使用 |
| `refCount`        | 自增   | 使用次数   |

Buffer 同理

这样之后的 Debug 面板等就可以利用记录下来的信息做可视化等
---
tags:
  - Unreal Engine
  - 游戏引擎
  - 面向对象
---

# UE 接口

正常来说，在 `C++` 内实现接口就直接写个纯虚类。但是由于这是 `U++`，其庞大的**反射系统、蓝图、编辑器、序列化、`UFUNCTION` 调用机制**等作用下，就需要遵照 UE 的接口形式来写

## 普通使用

```C++
UINTERFACE(...)
class UxxxInterface : public UInterface
{
    GENERATED_BODY()
};

class IxxxInterface
{
    GENERATED_BODY()

public:
    // 接口函数
};
```

| 部分                       | 作用                      |
| ------------------------ | ----------------------- |
| `UxxxInterface`          | 给 UE 反射系统看的 UObject 壳   |
| `IxxxInterface`          | 给 C++ 继承和实现用的真正接口       |
| `UFUNCTION`              | 让接口函数能进入 UE 反射系统、蓝图调用系统 |
| `Execute_FunctionName()` | 安全调用接口函数，兼容 C++ 和蓝图实现   |

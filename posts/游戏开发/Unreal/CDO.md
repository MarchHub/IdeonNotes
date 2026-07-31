---
tags:
  - Unreal Engine
  - 游戏引擎
  - 反射
---

# CDO

CDO,Class Default Object,即提供了一个类的默认模板，每个 `UClass` 在内存中都会且仅会有一个对应的 CDO 实例

实例化新对象（`NewObject`/`SpawnActor`）的底层流程是：分配内存 -> 执行 C++ 构造函数 -> 从 CDO 拷贝 `UPROPERTY` 覆盖当前值。

## 提高效率

在序列化的时候,原先的做法是为每一个对象的所有可序列化成员对进行一次序列化,但是引入了CDO之后,只需要做差量序列化 —— 记录不一样的字段即可,大大减少资产体积.

## 源码简述

[Class.cpp](https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/Class.cpp#L5055) 中的`CreateDefaultObject`即CDO的创建方法.

```C++
UObject* NewClassDefaultObject = StaticAllocateObject(this, GetOuter(), NAME_None, EObjectFlags(RF_Public | RF_ClassDefaultObject | RF_ArchetypeObject));
```

在创建 CDO 的时候该实例会被打上`RF_ClassDefaultObject` 和 `RF_ArchetypeObject` 的标记,用于之后对于 CDO 和 Archetype 的判断

不难发现，CDO 在引擎初始化或模块加载时即被创建，早于 `GameInstance` 和 `World`。所以只要一个类被加载，反射系统生成 `UClass` 时就必然会触发 CDO 的创建

## 注意事项

- 在构造函数中访问 World 或执行一些业务逻辑：由于 CDO 的创建非常早， 所以 World 可能还为空，若此时在构造函数中执行如查找本地玩家、加减血量、生成 Actor 等操作，爆！
- 全局状态污染：在运行时获取 CDO 然后对其部分字段进行修改 —— 那么此后所有此类的实例化对象都会默认携带这个被污染的值

## 使用

获取 CDO

```C++
// 已知明确的 C++ 类型 T，最高效、最常用的静态方法
AMyActor* DefaultActor = GetDefault<AMyActor>();

// 只有 UClass* 指针（例如从蓝图传过来的 TSubclassOf<AActor>）
UClass* MyClass = AMyActor::StaticClass();
AMyActor* DefaultObj = MyClass->GetDefaultObject<AMyActor>();

// 有具体的实例指针，想获取它对应类的默认值
AMyActor* MyInstance = ...; 
AMyActor* CDOFromInstance = Cast<AMyActor>(MyInstance->GetClass()->GetDefaultObject());
```

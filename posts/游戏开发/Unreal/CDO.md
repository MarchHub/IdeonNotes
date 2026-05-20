# CDO

CDO,Class Default Object,即提供了一个类的默认模板.

## 提高效率

假设在大量实例化一个对象的情况下,反复的开辟空间,执行构造函数是一件很贵的事情.而使用CDO之后,可以在实例化新对象的时候直接完整拷贝内存,规避反复执行构造函数的开销.

在序列化的时候,原先的做法是为每一个对象的所有可序列化成员对进行一次序列化,但是引入了CDO之后,只需要做差量序列化 —— 记录不一样的字段即可,大大减少资产体积.



## 源码简述

[Class.cpp](https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/Class.cpp#L5055) 中的`CreateDefaultObject`即CDO的创建方法.

```C++
UObject* NewClassDefaultObject = StaticAllocateObject(this, GetOuter(), NAME_None, EObjectFlags(RF_Public | RF_ClassDefaultObject | RF_ArchetypeObject));
```

在创建 CDO 的时候该实例会被打上`RF_ClassDefaultObject`的标记,用于之后的判断

不难看出,只要被都会在生成反射信息 `UClass` 的过程中，会触发 CDO 的创建(这是一个**坑点**)


## 注意事项

由于CDO的创建是必须会被触发的 —— 所以如果在构造函数中写一些游戏逻辑相关(比如根据状态加减血量等), 因为构造函数执行时，世界 (`World`) 可能还不存在，因此**绝对不能在构造函数中执行需要世界环境的操作或内存分配**（调用 `GetWorld()` 或生成其他 Actor）

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
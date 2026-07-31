---
tags:
  - Unreal Engine
  - 游戏引擎
  - 反射
---

# UE 反射机制

> Reflection is the ability of a program to examine itself at runtime. This is hugely useful and is a foundational technology of the Unreal engine, powering many systems such as detail panels in the editor, serialization, garbage collection, network replication, and Blueprint/C++ communication. —— [Unreal Property System (Reflection)](https://www.unrealengine.com/blog/unreal-property-system-reflection?lang=zh-CN)

说的不错，基本上各种系统都是围绕着UE反射系统运作，所以理解显得格外重要。

## 实现机制

也是非常经典的 —— 宏定义标记，然后使用`UHT(Unreal Header Tool)`来进行收集和处理，最后在 runtime 的时候使用。

分阶段描述可能比较清晰——

### 编译前

使用宏定义标记数据，

从它们的 [ObjectMacros](https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Public/UObject/ObjectMacros.h) 中不难看出，类似

- UCLASS
- UPROPERTY
- UFUNCTION

等之类的都是空定义
- C++编译器来说并没有什么影响
- UHT 通过它们来识别哪些声明需要被反射系统处理
- 部分宏（比如 `UCLASS` / `GENERATED_BODY`）还会展开为 `StaticClass`、`StaticRegisterNatives` 等函数声明，为 UHT 生成的代码预留挂载点。（略有点复杂的嵌套宏展开）

### UHT 解析和代码生成

捕获标记，代码生成，维护反射信息。UHT 在编译前扫描这些宏，生成 `.generated.h` 与 `.gen.cpp` 文件 —— 在生成的代码里注入反射用到的函数声明和友元。

- **`.generated.h`**：负责把 `GENERATED_BODY()` 宏等真正展开，补全前面提到的函数声明和友元注入。
- **`.gen.cpp`**：UHT 在这里生成各种代码模板，比如类似 `struct Z_Construct_UClass_UMyClass_Statics` 的构造结构体

### 注册阶段

利用语言特性自动触发全局静态对象的构造函数，运行生成的注册方法，将当前类的全部元数据（类名、父类指针、属性列表、函数指针等）全部塞进 UE 全局的反射哈希表（实际上更复杂，会先入队`TArray<FRegistrant> Registrations`然后在main前**延迟注册** —— 一方面是依赖静态函数触发的注册会出现乱序，另一方面引擎的各种“基建”在此时还未搭建完毕（初始化好），这样完整的注册时序可以完全由引擎开发者掌握，可以避免掉引擎各个部分乱序初始化的问题

具体元数据的存储可以参考[class.h](https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Public/UObject/Class.h)以及[UnrealType](https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Public/UObject/UnrealType.h)

不过`FProperty`中最重要的几个参数 ——

- **Type（类型系统）**：明确当前变量的精确数据类型，用于在序列化或蓝图虚拟机交互时进行类型安全检查和强转
- **Offset（内存偏移量）**：**反射的灵魂！😭😭🙏** 它记录了该属性相对于其所在对象内存首地址的偏移字节数（`Offset_ForInternal`）。运行时对属性的读写，本质上就是 `Object_BaseAddress + Offset` 的内存暴力寻址。
- **MetaData（元数据）**：存储诸如 `EditAnywhere`、`BlueprintReadWrite` 等业务标签，供编辑器 UI（细节面板）和蓝图系统决定如何展现和限制该变量。****

## 使用

（~~遇事不决查下手册或者问问神奇海螺~~）

简单例子
```C++
UCLASS(Blueprintable)
class AMyActor : public AActor
{
    GENERATED_BODY()

public:
    // 标记为属性，生成 FIntProperty，允许蓝图读写
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Health;

    // 标记为函数，生成 UFunction，允许蓝图调用
    UFUNCTION(BlueprintCallable)
    void Fire();
};
```
上述使用UCLASS等来进行声明， 类型和签名都比较清晰，就不再赘述（

我们也可以在运行时进行查询

```C++
UClass* Cls = AMyActor::StaticClass();

// 安全，且可以继承链往上找父类的属性)
for (TFieldIterator<FProperty> PropIt(Cls); PropIt; ++PropIt)
{
    FProperty* Prop = *PropIt;
    UE_LOG(LogTemp, Log, TEXT("Property: %s, Offset: %d"), *Prop->GetName(), Prop->GetOffset_ForInternal());
}

// 查找并调用函数 (蓝图调用 C++ 的底层原理)
UFunction* Func = Cls->FindFunctionByName(TEXT("Fire"));
if (Func)
{
    AMyActor* Obj = ...;
    // ProcessEvent 将参数内存块首地址喂给虚拟机执行
    Obj->ProcessEvent(Func, nullptr); 
}
```

## 注意

由于UE的GC也是基于反射实现的，所以在一个类中使用非反射的属性需要**注意**一下 —— 如果老爹被GC了，但是子类指针是非反射属性 —— ？！垂悬！？，所以不要在 UCLASS 里随便塞 `UObject*` 成员而不加 `UPROPERTY`，比较危险，所以建议使用UE的智能指针或者加上宏
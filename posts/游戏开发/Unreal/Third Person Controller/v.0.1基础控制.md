# 基础控制

既然 UE 的 Gameplay 提供了参数丰富的CharacterMovementComponent，不妨直接用，然后进行参数等的修改

建立第三人称模板时候，默认已经实现了最基础的 Character, PlayerController, 并且定义好了 GameMode 可以直接使用

## 基础行为拓展

已经定义好了基础 Move, Jump 和 Look，但是还不够，还要更多些 —— 先添加 Dash 和 Sprint

- 建立 IA
- 绑定 Input Mapping Context
- 在 Character 中声明并且绑定按键触发的事件
- 在 Blueprint 中配置具体 IA / IMC 引用

一套非常明确的流程

Dash 的时候设置一个 CoolDown Time, 非常方便, 可以在计时器结束的时候直接触发回调函数, 鉴定为比 Unity 协程更方便

## 手感优化

### 摄像头

默认不带 CameraLag，不过平滑跟随是对的

`USpringArmComponent` 文档说明，Spring Arm 可以作为 camera boom 使用，让相机与玩家保持距离，并在碰撞时自动收缩；其中 `bEnableCameraLag` 会让相机位置滞后目标位置，从而平滑移动，`CameraLagSpeed` 控制相机追上目标的速度。

于是 ——

```C++
CameraBoom->bEnableCameraLag = true;
CameraBoom->CameraLagSpeed = 12.0f;
```

特别的, `CameraLagSpeed=0` 表示无滞后 / 直接跟随

>[!note] 注意：CameraLagSpeed 只有在 bEnableCameraLag = true 时才参与计算。



### 移动

`BrakingDecelerationWalking` 停下移动时的阻力, 如果数值设置小可以类似在冰面滑动

同样的，`BrakingDecelerationFalling` 是控制在空中的水平速度衰减

`RotationRate` 角色转身速度

| Yaw RotationRate | 感觉      |
| ---------------: | ------- |
|            `360` | 转身慢，有重量 |
|            `540` | 模板常见值   |
|      `640 ~ 720` | 动作游戏更灵敏 |
|           `900+` | 很快，偏硬   |

`AirControl` 下落时候（Falling 状态）在空中左右调整方向的能力, 范围是$[0, 1]$，0 表示没有空中控制，1 表示可以接近 MaxWalkSpeed 的完整横向控制。

## 关于UPROPERTY

首先要把 Details 面板和 Blueprint 中的节点分开看

比如

```C++
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Walk")
float WalkSpeed = 500.0f;
```

此处的

- `EditDefaultsOnly`指在 Details 面板可以修改默认值（但是修改的是类默认对象
- `BlueprintReadOnly`指在 蓝图中的节点中无法修改


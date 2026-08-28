---
tags:
  - C
  - 输入与控制
  - 信号处理
---

# PID

## 用途

PID 用于实现闭环控制。

闭环控制就是不断重复下面的过程：

1. 设定目标值
2. 读取传感器测量值
3. 计算目标值和测量值的误差
4. 根据误差计算控制量
5. 将控制量输出给执行器

例如电机速度控制：

```text
目标速度 -> PID -> PWM -> 电机 -> 编码器测得实际速度
    ^                                  |
    |__________________________________|
```

PID本身不会直接控制电机，它只负责根据误差计算输出值。输出值可以是PWM、力矩、电流等。

## 公式

连续PID公式：

$$
u(t)=K_p e(t)+K_i\int_0^t e(\tau)d\tau+K_d\frac{de(t)}{dt}
$$

单片机中使用离散形式：

$$
u_k=K_p e_k+K_i\sum_{j=0}^{k}e_jT_s+K_d\frac{e_k-e_{k-1}}{T_s}
$$

其中：

- $u_k$：本次PID输出
- $e_k$：本次误差，$e_k=目标值-测量值$
- $e_{k-1}$：上一次误差
- $T_s$：PID计算周期
- $K_p$、$K_i$、$K_d$：比例、积分、微分系数

如果PID调用周期固定，可以把 $T_s$ 合并到 $K_i$ 和 $K_d$ 中，简化为：

$$
u_k=K_p e_k+K_i\sum_{j=0}^{k}e_j+K_d(e_k-e_{k-1})
$$

## 细说三种控制作用

P、I、D严格来说不是三种算法，而是PID中的三种**控制作用**。

### 1. P：比例作用

$$
P=K_p e_k
$$

$e_k \rightarrow$ 当前误差。

误差越大，输出越大；误差越小，输出越小。P负责让系统快速靠近目标值，是PID最主要的部分。

- $K_p$ 太小：响应慢，控制效果弱
- $K_p$ 太大：容易超调、震荡
- 只有P：一般会留下稳态误差

例如电机受到摩擦力时，需要保持一定PWM才能继续转动。但是误差变小后，P的输出也会变小，最后可能停在一个不为0的误差上。

### 2. I：积分作用

$$
I=K_i\sum_{j=0}^{k}e_jT_s
$$

$\sum e_jT_s \rightarrow$ 误差对时间的累积。

只要误差长时间不为0，积分值就会继续增加，直到产生足够的输出消除稳态误差。

- $K_i$ 太小：消除稳态误差很慢
- $K_i$ 太大：容易超调、低频震荡
- 输出长时间到达极限：容易形成积分饱和

积分不只是“精细控制”时才使用。只要系统存在持续的负载、摩擦或偏差，并且要求消除稳态误差，就可以使用积分。

### 3. D：微分作用

$$
D=K_d\frac{e_k-e_{k-1}}{T_s}
$$

$e_k-e_{k-1} \rightarrow$ 误差的变化量。

D根据误差的变化趋势提前进行抑制，相当于增加阻尼，减少超调，使测量值更平缓地接近目标值。

- $K_d$ 太小：抑制超调的效果不明显
- $K_d$ 太大：会放大传感器噪声，输出容易抖动
- 目标值突然变化：对误差微分可能产生“微分冲击”

当误差定义为“目标值 − 测量值”时，$K_p$、$K_i$、$K_d$ 通常都取正值，不需要故意让 $K_d$ 与 $K_p$ 符号相反。电机方向反了时，应统一修改执行器方向或误差方向。

## 位置式PID和增量式PID

### 位置式PID

位置式PID直接计算本次完整输出：

$$
u_k=K_p e_k+K_i\sum e_jT_s+K_d\frac{e_k-e_{k-1}}{T_s}
$$

优点：含义直观，输出限幅方便。

缺点：积分项需要专门处理，否则容易积分饱和。

位置、角度、温度控制通常使用位置式PID。后面的串级PID也使用位置式PID。

### 增量式PID

增量式PID计算的是输出变化量：

$$
\Delta u_k=K_p(e_k-e_{k-1})+K_i e_kT_s+K_d\frac{e_k-2e_{k-1}+e_{k-2}}{T_s}
$$

然后累加到原输出：

$$
u_k=u_{k-1}+\Delta u_k
$$

优点：每次只改变一部分输出，适合速度控制。

缺点：参数含义没有位置式直观，输出仍然需要限幅。

## 位置式PID的C语言实现

### PID结构体

```c
typedef struct
{
    float kp, ki, kd;
    float integral, last_error;
    float integral_limit, output_limit;
} PID_t;
```

### 限幅函数

```c
static float Limit(float value, float limit)
{
    if (value > limit)  return limit;
    if (value < -limit) return -limit;
    return value;
}
```

### PID计算

```c
float PID_Calculate(PID_t *pid, float target, float measure, float dt)
{
    float error = target - measure;
    float derivative = (error - pid->last_error) / dt;

    pid->integral += error * dt;
    pid->integral = Limit(pid->integral, pid->integral_limit);
    pid->last_error = error;

    return Limit(pid->kp * error
               + pid->ki * pid->integral
               + pid->kd * derivative,
                 pid->output_limit);
}
```

电机停机或切换控制模式时，要把 `integral` 和 `last_error` 清零。

### 基础用法

假设控制周期为1ms，PID输出作为电机PWM：

```c
PID_t speed_pid = {2.0f, 0.5f, 0.0f, 0, 0, 1000, 10000};

// 每1ms调用一次
void Motor_Control_1ms(void)
{
    float pwm = PID_Calculate(&speed_pid, 100.0f,
                              Encoder_GetSpeed(), 0.001f);
    Motor_SetPWM((int16_t)pwm);
}
```

`PID_Calculate()`必须以固定周期调用。周期不稳定时，微分项和积分项也会不稳定。

## 双串级PID：位置（方向）环-速度环

### 原理

在循迹小车中，“位置”不是电机转过的圈数，而是小车相对赛道中心线的位置。传感器得到的循迹偏差就是位置外环的误差。

```text
循迹误差 -> [方向外环PD] -> 左右轮速度差
                              |
              基础速度 +-----+-----> 左轮目标速度 -> [左速度环PI] -> 左PWM
              基础速度 ------+-----> 右轮目标速度 -> [右速度环PI] -> 右PWM
```

方向外环输出 `place_out`。转弯时把它分别加到、减去左右轮的基础速度：

$$
v_{left}^{*}=v_{base}+u_{place}
$$

$$
v_{right}^{*}=v_{base}-u_{place}
$$

这样一侧轮子加速、另一侧轮子减速，小车就会转向。实际应该哪边加、哪边减，取决于电机安装方向和循迹误差的正负定义。

外环使用PD：P根据当前偏差转向，D抑制方向变化过快。也可以加入陀螺仪Z轴角速度作为附加阻尼。

内层左右轮速度环使用增量式PI：

$$
u_k=u_{k-1}+K_i e_k+K_p(e_k-e_{k-1})
$$

### 核心代码

```c
float place_out;
float place_last_error;

void place_pid(float error, float gyro_z)
{
    place_out = place_kp * error
              + place_kd * (error - place_last_error)
              - place_gyro_kd * gyro_z;
    place_last_error = error;
    place_out = Limit(place_out, 200.0f);
}

/* 左右轮共用一个增量式PI函数，各自保存历史数据 */
float speed_pi(float target, float measure,
               float *last_error, float *out)
{
    float error = target - measure;
    *out += speed_ki * error
          + speed_kp * (error - *last_error);
    *last_error = error;
    return *out = Limit(*out, 10000.0f);
}
```

调用顺序：先计算方向外环，再计算左右轮速度环，最后把 `l_speed_out` 和 `r_speed_out` 送给电机。

```c
void car_control(void)
{
    place_pid(Get_Track_Error(), Get_Gyro_Z());
    float l_pwm = speed_pi(base_speed + place_out, Get_Left_Speed(),
                           &l_last_error, &l_out);
    float r_pwm = speed_pi(base_speed - place_out, Get_Right_Speed(),
                           &r_last_error, &r_out);
    Motor_SetPWM(l_pwm, r_pwm);
}
```

## 三串级PID：方向环-角速度环-速度环

### 原理

双串级中，方向外环直接改变左右轮目标速度。三串级在中间增加一个角速度环：

```text
循迹误差 -> [方向外环PD] -> 期望Z轴角速度
                                  |
陀螺仪Z轴角速度 -> [角速度内环PD] -> 左右轮速度差修正量
                                          |
                      基础速度 +----------+-> 左速度环PI -> 左PWM
                      基础速度 -----------+-> 右速度环PI -> 右PWM
```

三层的任务分别是：

1. 方向外环：根据循迹偏差决定小车应该以多大的角速度转向
2. 角速度环：比较期望角速度和陀螺仪Z轴角速度，算出左右轮速度差
3. 速度环：让左右电机分别跟随修正后的目标速度

相比双环，三环不是只凭循迹偏差“猜”一个左右轮速度差，而是增加陀螺仪反馈，直接控制小车实际转向的快慢。这样抗扰动更好，但参数更多，调试顺序也更重要。

### 核心代码

```c
float outer_dir_out, outer_last_error;
float inner_dir_out, inner_last_error;

void outer_dir_pid(float error)
{
    outer_dir_out = outer_kp * error
                  + outer_kd * (error - outer_last_error);
    outer_last_error = error;
    outer_dir_out = Limit(outer_dir_out, 300.0f);
}

void inner_dir_pid(float gyro_z)
{
    float error = outer_dir_out - gyro_z;
    inner_dir_out = inner_kp * error
                  + inner_kd * (error - inner_last_error);
    inner_last_error = error;
    inner_dir_out = Limit(inner_dir_out, 200.0f);
}
```

速度环仍然使用双串级中的 `speed_pi()`，只是把修正量由 `place_out` 换成 `inner_dir_out`。完整调用顺序：

```c
void car_control(void)
{
    outer_dir_pid(Get_Track_Error());
    inner_dir_pid(Get_Gyro_Z());
    float l_pwm = speed_pi(base_speed + inner_dir_out, Get_Left_Speed(),
                           &l_last_error, &l_out);
    float r_pwm = speed_pi(base_speed - inner_dir_out, Get_Right_Speed(),
                           &r_last_error, &r_out);
    Motor_SetPWM(l_pwm, r_pwm);
}
```

外环、中环和内环不一定要同频运行。一般越靠近电机的环频率越高，例如速度环1ms、角速度环2ms、方向外环5ms。若按不同频率执行，某一层未运行时就保持它上次的输出。

> 代码中的参数和正负号只是示例。若小车偏得越多却转得越偏，应先检查误差、陀螺仪和电机方向，不要直接把所有PID参数改成负数。

## PID调参顺序

### 单环PID

1. 先令 $K_i=0$、$K_d=0$
2. 从小到大增加 $K_p$，直到响应足够快，但还没有持续震荡
3. 逐渐增加 $K_i$，消除稳态误差
4. 如果超调较大，再适量增加 $K_d$
5. 每次只调整一个参数，并记录响应曲线

并不是每个系统都需要完整的PID：

- P：允许存在稳态误差时使用
- PI：速度环、电流环中很常见
- PD：位置环、角度环中常见
- PID：同时要求响应速度、稳态精度和阻尼时使用

### 串级PID

串级PID必须从内到外调：

```text
双环：左右轮速度环 -> 位置（方向）环
三环：左右轮速度环 -> 角速度环 -> 方向外环
```

调内环时，先断开或固定外环的输出。只有内环能够稳定跟随目标值后，才能继续调外环。

外环输出必须限幅，因为它会成为内环的目标值或目标值修正量。如果外环给出的期望角速度、左右轮速度差超过小车能力，内环就会长时间饱和，整个系统容易失控。

## 实际使用中的问题

### 1. 积分饱和

执行器已经输出到最大值，但误差仍存在，积分会继续累加。等系统接近目标值时，过大的积分仍会推动系统继续运动，产生严重超调。

最简单的处理方法是限制积分值，也可以在输出饱和时停止同方向积分。

### 2. 微分噪声

微分会放大传感器噪声。编码器速度或IMU数据抖动明显时，可以：

- 对测量值或微分项进行低通滤波
- 减小 $K_d$
- 不使用D，只使用PI或P

### 3. 输出死区

电机PWM较小时可能无法克服静摩擦。可以增加死区补偿，但补偿值过大会使电机在目标点附近来回抖动。

### 4. 单位必须统一

位置、速度、角度和角速度都要明确单位。单位改变后，PID参数也要重新调整。

### 5. 安全保护

真实设备至少要考虑：

- PWM限幅
- 电流和温度保护
- 传感器异常检测
- 电机堵转检测
- 角度过大时停机
- 控制任务超时后关闭输出

PID只能计算控制量，不能代替安全保护。

## 总结

- P看现在：误差有多大
- I看过去：误差累积了多久
- D看趋势：误差正在怎样变化

串级PID把一个复杂问题拆成多个简单问题：外环决定内环的目标，内环快速完成这个目标。

无论单环还是串级，都要先确认误差方向、运行周期、单位和输出范围，再开始调参。

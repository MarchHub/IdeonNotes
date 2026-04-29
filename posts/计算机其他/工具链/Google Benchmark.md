---
tags:
  - benchmark
  - 工具链
  - cmake
---
# Google Benchmark

简述一下`Google Benchmark`的使用。

## 基础框架

```C++
#include <benchmark/benchmark.h>

static void BM_StringCreation(benchmark::State& state) {
    // Setup
    for (auto _ : state) {
        // --- 受测代码开始 ---
		...
        // --- 受测代码结束 ---
    }
    // Teardown
}
// 注册测试 可以添加多个
BENCHMARK(BM_StringCreation);

// 开启程序入口
BENCHMARK_MAIN();
```

上述就是基本用法，可惜没有像是C#一样简单的反射语法可以快速搞定多个测试文件（

## 进阶用法

### 编译器优化

有时候编译器优化会使得我们的一些方法测试不出来，举个简单例子——

```C++
static void BM_VectorAccess(benchmark::State& state) {
    std::vector<int> v(100, 1);
    for (auto _ : state) {
        int val = v[50];
        benchmark::DoNotOptimize(val); // 确保 val 的读取不会被跳过
    }
}
```

对于为使用的 `val` 会被编译器优化掉，所以需要添加上`DoNotOptimize`来进行一些优化规避——

```Text
BM_VectorAccess                        0.209 ns        0.209 ns   3446153846
BM_VectorAccess                        0.277 ns        0.276 ns   2488888889
```

第一个是被编译器优化后的结果；第二个是写上`DoNotOptimize`的结果，可以看到差距还是非常大的

### 自定义注入参数

```C++
static void BM_VectorResize(benchmark::State& state) {
    for (auto _ : state) {
        std::vector<int> v;
        v.reserve(state.range(0)); // 获取参数
        benchmark::DoNotOptimize(v);
    }
}
// 显式传入参数
BENCHMARK(BM_VectorResize)->Arg(64)->Arg(512)->Arg(4096);
// 或者生成 8 的幂次方范围：8, 64, 512, 4096
BENCHMARK(BM_VectorResize)->RangeMultiplier(8)->Range(8, 4096);
```

### 多线程测试

```C++
static void BM_AtomicAdd(benchmark::State& state) {
    static std::atomic<int> counter{0};
    for (auto _ : state) {
        counter.fetch_add(1, std::memory_order_relaxed);
    }
}
// 分别测试 1, 2, 4, 8 个线程并发的情况
BENCHMARK(BM_AtomicAdd)->Threads(1)->Threads(2)->Threads(4)->Threads(8);
```

### 复杂测试

```C++
class MyFixture : public benchmark::Fixture {
public:
    void SetUp(const ::benchmark::State& state) override { /* 初始化内存 */ }
    void TearDown(const ::benchmark::State& state) override { /* 释放资源 */ }
};

BENCHMARK_F(MyFixture, TestName)(benchmark::State& state) {
    for (auto _ : state) { /* ... */ }
}
```

## 其他

比如什么复杂度分析等，有用，不过后面有用到再说（
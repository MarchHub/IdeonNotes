# Benchmark

单独实现一个可执行程序作为Benchmark，不依赖 Editor 的运行.

```
ChikaBenchmark
    │
    ├── BenchmarkOptions       CLI 参数解析
    ├── BenchmarkSceneLayout   确定性场景数据生成
    ├── BenchmarkSceneFactory  将布局转换为 Scene/GameObject
    ├── BenchmarkRunner        Warmup/Sampling/Flush 状态机
    ├── SampleStatistics       p50/p95/p99 统计
    └── BenchmarkResult        JSON 序列化
            │
            ▼
       ChikaEngine
            │
            ├── Application / EngineContext
            ├── Framework / Scene
            ├── Renderer / RenderWorld
            └── RHI / Vulkan Timestamp
```
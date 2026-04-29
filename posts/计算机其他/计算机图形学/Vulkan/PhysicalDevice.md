# PhysicalDevice

之前说过，这是运行程序的主机上的物理设备，由于对方设备可能不一定支持一些渲染功能或者拥有多张卡供我们选择，所以需要在这一步进行一些 Check 然后选择渲染的物理设备。

查询所有设备——

```c++
uint32_t deviceCount = 0;                           // 设备数量
vkEnumeratePhysicalDevices(instance, &deviceCount, nullptr);
std::vector<VkPhysicalDevice> devices(deviceCount); // 设备数据
vkEnumeratePhysicalDevices(instance, &deviceCount, devices.data());
```

`VkPhysicalDeviceProperties` GPU的基本属性

- `deviceName`（显卡名字）
- `vendorID`（NVIDIA/AMD/Intel）
- `deviceType`（Discrete / Integrated / Virtual）
- `limits`（最大纹理尺寸、最大 uniform buffer 大小等）
- `apiVersion`（支持的 Vulkan 版本）

可以通过这些属性来进行评分或者输出日志

`VkPhysicalDeviceFeatures` 通过这个方法查找 GPU 的一些特性

```C++
vkGetPhysicalDeviceFeatures(device, &features);
```

比如是否支持各向异性过滤等，常见

- samplerAnisotropy
- geometryShader
- wideLines
- multiViewport
- shaderInt64
- fillModeNonSolid
- ……

查询显存大小
```C++
vkGetPhysicalDeviceMemoryProperties(device, &memProps);
```

==查询 Queue Family 支持情况==

```C++
vkGetPhysicalDeviceQueueFamilyProperties(device, &count, nullptr);
vkGetPhysicalDeviceQueueFamilyProperties(device, &count, families.data());
```

我们需要找到：

- 支持 **VK_QUEUE_GRAPHICS_BIT** 的 queue family    
- 支持 **present** 的 queue family（用 `vkGetPhysicalDeviceSurfaceSupportKHR` 查询）

如果两者不同，你需要创建两个 queue。



# 服务管理和广播系统

## Service Locator

服务注册器，基本上针对单例模式下的各种 manager

提供功能 ——
- 注册服务
- 删除服务
- 替换服务
- 清空

使用服务托管，避免静态变量可能出现的问题，在需要使用的时候，直接使用`resolve`来获得引用，从而调用其中的方法。

## Event bus

提供
- 订阅
- 取消订阅
- Publish
三个基础功能，其中使用channel来对应事件分发


## Usage

在`Bootstrap`中实例化`Service Locator`；之后跨场景调用的时候，可以查找到`Bootstap`中的`Service Locator` （反复调用可以进行一个缓存）然后使用
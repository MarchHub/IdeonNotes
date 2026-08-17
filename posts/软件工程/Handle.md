# Handle

句柄的一种设计,不赖.原先我们或许可以使用指针/引用等直接对资源进行借用,这会导致资源的管理,开放的权限等出现边界模糊.于是引入 handle 这一层的设计使得资源的管理和持有再进行解耦

可以看成一种 ID,持有了 handle 说明我们「持有」了这个资源,但是具体我们拥有什么访问或者读写权限,就要看 Manager 开放什么样的接口.

比如

```C++
const auto source = manager.get(handle);    // 可以表示获取资源
handle = manager.modify(handle, newData);   // 可以表示修改
```

这样外部代码不必直接依赖资源本身的存储方式，同时 Manager 也可以围绕 Handle 统一进行资源查找、访问控制、valid check、lifetime management 等操作。

综上所述,就是用一个ID来进行间接调取资源,调用方自己不持有资源本身,而是把权限全部收给manager来进行管理,舒服


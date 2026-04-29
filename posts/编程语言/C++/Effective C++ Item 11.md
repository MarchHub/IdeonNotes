# Effective C++ Item 11

《Efficient C++》Item 11 的 等号赋值这块，确实很多是之前会忽略的东西 —— 比如 `a = a` 这种看上去有点愚蠢的写法。

## 赋值写法

书中提供了一种不那么优雅但是可以正常运作的 ——

```C++
Widget& Widget::operator=(const Widget& rhs)
{
    Bitmap *pOrig = pb;          
    pb = new Bitmap(*rhs.pb);    
    delete pOrig;                
    return *this;
}

```

分析 ——

1. 首先使用 `pOrig` 来指向 `pb` 原来指向的内存空间
2. 接着使用 `new` 来实现 " 深拷贝 "
	1. 如果 `new` 抛出异常退出，则 `pb=` 这个赋值语句失效，函数返回，因为尚未执行 `delete` 语句，所以 `pb` 还是原数据
3. `delete` 销毁原 `pb` 指向的内存空间，实现资源释放
4. 函数体执行结束 `pOrig` 在栈空间上自动释放

综上，实现了一次深拷贝的赋值运算，同时规避了旧的pb指向新内存空间导致的内存泄露

## 写在后面

为什么说它可用但不优雅 —— 一个是可以使用智能指针 RAII 来进行资源管理，另一方面，使用`copy‑and‑swap` 会更优雅（保证异常安全，）
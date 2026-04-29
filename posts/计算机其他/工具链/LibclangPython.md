# Libclang Python

Clang, 一个C相关的编译前端,把 C/C++ 的源码做成：
- 词法分析（Lexer）
- 语法分析（Parser）
- 语义分析（Sema）
- 抽象语法树（AST）

这次重点说一下读取 AST 的这段.

## 为什么写本篇

在自己乱写引擎的时候,写到反射阶段,本想使用C++原生态的实现Clang工具提供的接口,但是又觉得python做这种小工具可能比较方便,于是来一段python来读写C++编译过程中的AST树的这一部分.

## 正文

首先对于clang++的简单使用——
```bash
clang++ file.cpp [args]
```
那么如果是分析一些简单的源文件,在命令行中也只需要——
```bash
clang++ file.cpp -std=20
```
诸如此类.

但是为了应对复杂的链接关系、头文件等,参数就肯定不会如此简单.所以为了实现一个复杂的系统,就希望有工具可以帮忙提供这些参数.
于是使用到了cmake,当
```cmake
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
```
我们借助cmake生成compile command的时候,就可以读取它(存放在`build/commpile_commands.json`)

这是一个在各个平台格式上一致,但是实际上内容不一样的东西(为了符合每一个编译环境下而导致内容不一).

所以,只需要对其进行一个数据上的清洗就可以获得我们的args了

### 主要流程

#### 创建 Index

~~先拿下茵蒂克丝!~~

为了调用clang前端,需要先创建一个index,
```python
clang.cindex.Index.create()
```
这相当于整个clang前端的入口,在其中启动了clang,并且缓存下来,为后续的解析文件等提供了缓存、诊断等能力

### 拿下 args

获取编译参数,可以从compile_commands.json中获取,也可以手动创建,简言之就是需要创建一个list对象,其中每一个元素都是我们的编译参数

libclang提供了一个提取参数的方法
```python
compdb = clang.cindex.CompilationDatabase.fromDirectory(build_dir)
commands = compdb.getCompileCommands(abs_path)
args = list(commands[0].arguments)
```
需要注意的是,此处的`args`是尚未经过清洗的args,还不太能用(因为包含了如C++路径,源文件路径等的编译无关信息),所以仍旧需要经过一个清洗的方法,才可以传递给接下来的步骤使用

### 开始编译

```python
tu = index.parse(file_path, args=args)
```
`tu:TranslationUnit`,就是解析好的对象(~~所以index何尝不算一种TranslationUnit的工厂方法~~)
其中经过了预处理、词法分析、语法分析、语义分析和AST树构建等的步骤(调用clang),最后再封装成为`TranslationUnit`对象返回.
其中`tu.cursor`,就是整个AST树的根节点,后期解析主要聚焦在这上面
### 继续解析

```python
root = tu.cursor

for child in root.get_children():
    ...
```

先看下最简单的AST树遍历
```python
from clang.cindex import Index

def visit(node, depth=0):
    print("  " * depth, node.kind, node.spelling)
    for child in node.get_children():
        visit(child, depth + 1)

index = Index.create()
tu = index.parse("test.cpp", args=["-std=c++20"])
visit(tu.cursor)

```
好的,其实就是最基础的深度优先遍历,贴一下简单的执行结果
```txt
 CursorKind.TRANSLATION_UNIT /Users/machillka/Workspace/Program/temp/tools/test.h
   CursorKind.NAMESPACE ChikaEngine
     CursorKind.NAMESPACE Temp
       CursorKind.CLASS_DECL Temp
         CursorKind.ANNOTATE_ATTR reflect-class,
         CursorKind.CXX_ACCESS_SPEC_DECL 
         CursorKind.FRIEND_DECL 
           CursorKind.TYPE_REF class ChikaEngine::Temp::Reflector_Temp
         CursorKind.CXX_ACCESS_SPEC_DECL 
         CursorKind.CXX_METHOD GetClassName
           CursorKind.COMPOUND_STMT 
             CursorKind.RETURN_STMT 
               CursorKind.UNEXPOSED_EXPR 
                 CursorKind.STRING_LITERAL "Temp"
         CursorKind.FIELD_DECL id
           CursorKind.ANNOTATE_ATTR reflect-field,
           CursorKind.INTEGER_LITERAL 
         CursorKind.CXX_METHOD ShowID
           CursorKind.ANNOTATE_ATTR reflect-function,
```
对应的源文件为
```C++
// temp.h
#pragma once
#include "reflect.h"
namespace ChikaEngine::Temp {
	MCLASS(Temp) {
	  public:
		REFLECTION_BODY(Temp)
		MFIELD()
		int id = 114;
		MFUNCTION()
		void ShowID();
	};
} // namespace ChikaEngine::Temp
```
其中有用到两个宏展开(因为这篇完全是在写引擎的时候做的,所以和引擎内容高度契合)
```C++
// reflect.h
#pragma once

#if defined(__REFLECTION_PARSER__)
#define MCLASS(CLASS_NAME, ...) \
class __attribute__((annotate("reflect-class," #__VA_ARGS__))) CLASS_NAME
#define MFIELD(...) __attribute__((annotate("reflect-field," #__VA_ARGS__)))
#define MFUNCTION(...) \
__attribute__((annotate("reflect-function," #__VA_ARGS__)))
#else
// 空实现
#define MCLASS(...)
#define MFIELD(...)
#define MFUNCTION(...)
#endif

// 提供一个友元函数的声明 在代码生成的时候实现
#define REFLECTION_BODY(CLASS_NAME) \
friend class Reflector_##CLASS_NAME; \
public: \
static const char* GetClassName() { return #CLASS_NAME; }
```

回到正文,我们会发现有两个重要字段——
- `node.kind`: 标记了这个节点是AST中的哪种类型
- `node.spelling`: 这个节点的文本内容(写了什么)

然后常见的节点类型
- `TRANSLATION_UNIT` 根节点
- class 相关
	- `CLASS_DECL` 类声明
	- `FIELD_DECL` 成员变量
	- `CXX_METHOD` 成员方法
	- `CONSTRUCTOR` 构造函数
	- `DESTRUCTOR` 析构函数
- `NAMESPACE` 命名空间
- `USING_DIRECTIVE` 宏定义

还有其他,建议查手册


最后,提供一个简单的收集反射数据
```python
def find_reflection(node, namespace="", res=None):
	if res == None:
		res = []
	if node.kind == CursorKind.NAMESPACE:
		# 从根目录开始计算的命名空间
		namespace += "::" + node.spelling
	if node.kind == CursorKind.CLASS_DECL and node.is_definition():
		if is_reflected_class(node):
		class_info = process_class(node, namespace)
		res.append(class_info)
	# 递归查找其他 class
	for child in node.get_children():
		find_reflection(child, namespace, res)
return res
```

补充一下文档[LibClang](https://clang.llvm.org/docs/IntroductionToTheClangAST.html)
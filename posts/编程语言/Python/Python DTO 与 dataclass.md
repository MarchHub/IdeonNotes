---
tags:
  - Python
  - 软件工程
  - 类型系统
---

# Python DTO 与 dataclass

DTO，Data Transfer Object，数据传输对象

语义上更明确，清晰的知道一份数据中什么字段，什么类型，什么作用

比如说下面这个字典 ——

```python
payload = { 
	"character_id": "001",
	"message": "今天天气真好",
	"metadata": {},
}
```

没什么问题，但在 Python 中可以使用更清晰的表达 ——

```python
from dataclasses import dataclass, field
from collections.abc import Mapping
from typing import Any, NewType

CharacterId = NewType("CharacterId", str)

@dataclass(frozen=True)
class ChatInput:
    character_id: CharacterId
    message: str
    metadata: Mapping[str, Any] = field(default_factory=dict)
```

此处当我们构造一个 `ChatInput` 的时候里面要填写的内容和之前那个裸的字典是一致的，不过其语义和类型限制会变得更加清晰。

下面简单说说相关语法和一些其他在 Python 中设计 DTO 的时候常用到的语法

## dataclass

python 标准库中的一个支持，比较适合写轻量数据对象，比如 ——

```python
from dataclasses import dataclass

@dataclass
class GenerationConfig:
    temperature: float
    max_tokens: int
    stream: bool = False
```

它会自动生成初始化方法，所以可以直接创建

```python
config = GenerationConfig(
    temperature=0.7,
    max_tokens=1024,
)

# config.temperature 来进行访问
```

如果写成 `dict`，字段名只是字符串

```
config["temperature"]
config["max_tokens"]
```

则有可能出现问题 ——

- 容易拼错
- IDE 不好提示
- 重构不方便
- 调用方不知道到底需要哪些字段

### frozen = True

`frozen=True` 表示对象创建后不应该再被修改 —— 构造结束之后就是只读状态，这样在多个Service之间传递的时候不会出现“意外”（可变对象传递的时候中途被意外修改难以追踪）

但是需要注意的，此处当对象构造完成后，禁止重新给字段赋值，也禁止删除字段，但是对于字典列表等（或者自定义对象，内部维护了自己的数据的可变对象），调用里面的一些方法（比如添加键值对等操作）依旧是合法的，所以要小心此处对于数据进行的修改。

所以`frozen=True`大抵更多的是一种语义上的“冻结”

### field(default_factory=...)：处理可变默认值

对于 `dataclass` 的字段中，默认的空字典或者列表可变默认值可能被多个实例共享 ——

```python
@dataclass
class DebugTrace:
	events: list[str] = []

a = DebugTrace()
b = DebugTrace()

a.events.append("step1")

print(a.events) # ["step1"]
print(b.events) # ["step1"] ← 这里也被改了
```

这个 `[]` 只在类定义时创建了一次，之后所有实例都在用同一个列表对象。

为了在每次实例化的时候都生成一个新的默认值，则使用`field(default_factory=...)`的语法来实现，例子 ——

```python
from dataclasses import field

@dataclass
class DebugTrace:
	events: list[str] = field(default_factory=list)
	metadata: dict[str, object] = field(default_factory=dict)
```

还有更好的消息，`list[str] = []`这种写法已经被禁止了，会在 Runtime 的时候报错 ——

> Exception has occurred: ValueError
> mutable default <class 'list'> for field names is not allowed: use default_factory

### 字典

先说`Mapping`，其来自 `from collections.abc import Mapping`，抽象接口，表示对象支持按键**读取**数据，而`Dict`具体字典类型实现（`MutableMapping`），可读可写

所以在只读的情况下使用`Mapping`可能会更准确一些

如果需要明确要求字典中必须存在某些固定字段，可以使用 `TypedDict`构造一个新类型

```python
class Metadata(TypedDict):
	source: str
	language: str
	score: float
	note: NotRequired[str]
```

然后再在上层进行使用

### Any

先跳过类型检查（~~懒癌~~）—— 为了通配一些传进来的数据，比如在引言的例子中，`metadata`可能是一个外部传入的需要解析的`json`，就可以使用 `Any` 先进行跳过检查，在后面

## NewType

~~强类型的类型别名（我在说什么东西~~

有点像是类型别名，不过可以使得语义更明确（给维护者以及类型检查器）

比如

- `persona_mode_id`
- `character_id`

都是 `str` 类型，在传递参数等的时候直接标记类型为`str`于语义上不清晰，于是可以使用`NewType`进行定义 ——

```python
PersonaModeId = NewType("PersonaModeId", str)
CharacterId = NewType("CharacterId", str)
```

此时定义方法 ——

```python
def load_prompt(character_id: CharacterId, persona_mode_id: PersonaModeId) -> str: 
	...
```

此时虽然运行时还是以字符串在跑，但是在传参数的时候需要 ——

```python
cid = CharacterId("haruhi")
pid = PersonaModeId("default")
prompt = load_prompt(cid, pid)
```

就十分甚至九分的清晰


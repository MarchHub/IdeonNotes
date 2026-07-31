---
tags:
  - 机器学习
  - 大语言模型
---

# KV Cache

记录推理的运算过程中计算 `Key-Value` 的结果,以进行复用,减少在预测下一个Token的时候进行重复计算.

类比生活,将作文交由老师批改,没有KV Cache时 ——

- “老师第一句怎么修改” —— “我读一遍全文先”
- “老师第二句怎么修改” —— “我读一遍全文先”
- “老师第三句怎么修改” —— “我读一遍全文先”
- ……

而有了KV Cache —— 随着 prefill 过程的时候, llm 会类似记笔记

- 人物关系是什么
- 文章主题是什么
- 前文提到了哪些设定
- 语气是什么
- 重要信息在哪里

为每一层 attention 保存历史 token 的 Key-Value 记录下信息.

唔,简单来说
$$
KV Cache = 把历史 token 已经算好的 K/V 存起来
$$

所以 KV 缓存 不是长期记忆,也不是什么数据库知识库之类的,只是一个推理过程中用于减少重复计算的临时缓存.

## 从输入到 KV Cache 的数据流动

1. 用户输入
2. 拼接上下文(比如 System Prompt + 历史对话 + 当前用户输入)
3. 切成 Token
4. 经过词嵌入 Embedding 层
5. 喂给Transformer,其中每个Token 会在 attention 中产生三个向量QKV
6. 在 attention 中,每个 token 会产生自己的 Q/K/V 然后在 decode 阶段,当前新 token 的 Q 会查询历史 token 的 K/V.

## Prefill

是模型处理输入 prompt 的阶段.

比如完整上下文是 ——

```
系统提示词 + 历史对话 + 当前用户输入
```

模型会先把这整段上下文全部跑一遍.

这一步会:

- 把文本切成 token
- 把 token 变成向量(embedding
- 经过多层 Transformer
- 在每一层 attention 中计算每个 token 的 K/V
- 把这些 K / V 保存到 KV Cache 中

所以 prefill 阶段类似于先读完题目, 顺便把可复用的内部状态记下来

如果 prompt 很长, prefill 就会比较慢. 因为模型需要先处理完整输入,并为这些输入 token 建立初始 KV Cache.

## Decode

模型生成回复答案的阶段

每生成一个新 token,它都会被追加到上下文后面,然后参与下一个 token 的预测.

流程类似 ——

```
已有上下文 -> 预测 token_1
已有上下文 + token_1 -> 预测 token_2
已有上下文 + token_1 + token_2 -> 预测 token_3
...
```

于是 decode 阶段特别需要 KV Cache.

否则每生成一个新 token,模型都要把前面全部上下文重新算一遍.

原因是:

> Transformer 默认是无状态的 forward.
> 每次调用模型时,模型只根据这一次传入的 token 序列进行计算.
> 如果没有缓存机制,为了让模型看到完整历史,就只能重新输入完整上下文,从而重新计算历史 token 的中间结果.

## 例子说明与可行原因

先举例 —— 假设 prompt 是

```
A B C D
```

模型要生成:

```
E F G
```

没有 KV Cache 时:

```
预测 E: 重新计算 A B C D 的 K/V
预测 F: 重新计算 A B C D E 的 K/V
预测 G: 重新计算 A B C D E F 的 K/V
```

前面已经算过的 token 会被反复计算.

核心逻辑 ——

- 历史 K/V: 从 cache 中读取
- 当前 token 的 Q/K/V: 新计算
- 当前 token 的 K/V: 追加进 cache

这样就不需要每次都重新计算完整上下文.

## 为什么历史 K / V 可以复用

因为常见使用的 LLM 通常是 `decoder-only causal Transformer`.

其中, `causal` 表示每个 token 只能看自己和自己之前的 token, 不能看未来 token, 所以就很好的可以想到缓存过去 token 的 K / V, 因为一旦算出来,后续就可以复用,不赖.


## KV Cache 具体运用

KV Cache 可以提升单次询问推理的速度(空间换时间这块),而现在常见的 `Prefix Cache`、`Session Cache` 等机制,其底层也与KV Cache 相关.

因为在真实的使用环境中(多轮对话),维护的上下文窗口会把system prompt、历史对话、当前请求等一起打包成一次请求.

下面以 `prefix cache` 为例子,假设第一轮用户提出问题,那么在第二轮用户说“请深入说明”的时候,由于第二轮请求的前半部分为第一轮历史对话内容,前缀 Token 完全吻合,于是就可以复用第一轮缓存下来的`KV Cache`.(第一轮缓存了`ABC`,第二轮用户询问`DE`的时候,系统会把`ABC`也加入请求中,由于`ABC=ABC`,所以可以复用 `ABC` 的 `KV Cache`)

那么类似的,Session Cache 就是在一次完整的会话(好人机,不知道怎么说成大白话),保存并且复用历史 K/V 状态

## 实践: 减少 Cache Miss

当然,还是以调用别人的为主,所以为了减少cache miss(省钱提效),有些小的tips ——

- 固定内容放前面,动态内容放后面: 比如
- Prompt 模板尽量稳定
- 长对话要阶段性总结
- RAG / Agent 中保持检索结果稳定
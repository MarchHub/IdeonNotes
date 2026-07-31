---
tags:
  - 机器学习
  - 大语言模型
  - AI Agent
---

# Agent 综述

一直说，啊啊 Agent 啊啊 MCP 啊啊 Skill 把我的同事炼化成 Skill（开个玩笑

也一直在用，于是稍微说一下这些“码奸”造出来的一堆名词

## LLM

首先还得是 LLM，大语言模型，本质上是一个根据上下文预测、生成文本的一个模型，也是 Agent的”大脑“部分。

根据上下文做推理，理解自然语言，生成**回答**，或者生成结**构化的工具调用请求**，除此之外没什么特别的功能。

它本身不能访问互联网，读取本地文件，执行某某指令等，这些能力需要 Tool 提供
 
## Tools

类似与一个可调用方法，比如网络搜索，读写文件，发邮件等

>Tools extend what [agents](https://docs.langchain.com/oss/python/langchain/agents) can do—letting them fetch real-time data, execute code, query external databases, and take actions in the world. —— LangChain

引用一段 LangChain 手册中对于 Tools 的描述，实际上说的蛮清楚的

值得注意，LLM 只负责提出 Tool Call，真正执行工具的是 Agent Runtime 或 Tool Executor。

同时，这里可能是文件读写或者执行指令等，可能需要用户**授权**

## Prompt

用自然语言告诉模型应该怎么做

- System Prompt：最高层行为约束，规定模型身份、边界、优先级 ——
	- 你是什么角色；  
	- 你能做什么，不能做什么；  
	- 什么情况下必须拒绝；  
	- 什么情况下必须调用工具；  
	- 输出格式有什么要求。
- User Prompt：用户当前任务，比如”请给出完整代码💦“

## Agent Runtime  
  
Agent Runtime 可以理解为 Agent 的运行环境。  
  
LLM 负责生成判断和工具调用请求，但 Runtime 负责把这些请求真正执行起来。

Sandbox，Tool Runtime，状态管理，工作流编排等，都可以看作 Agent Runtime 统一调度和管理的运行时能力

## Agent

Agent 不是单纯的 LLM，也不是单纯的 Tool。

更工程化地说，Agent 是一个围绕目标运行的任务执行系统。它把 LLM、Prompt、Context、Tools、State、Memory、Runtime 等部分组织起来，让模型可以多步完成任务。

一个典型 Agent 的运行过程大概是：

1. 接收用户目标；
2. 构造当前上下文；
3. 调用 LLM 进行判断；
4. 如果 LLM 认为需要工具，就生成 Tool Call；
5. Runtime 验证并执行 Tool Call；
6. 工具结果写回上下文或状态；
7. LLM 继续推理；
8. 直到得到最终答案或达到停止条件。

所以 Agent 的关键不是“会聊天”，而是“可以围绕目标进行多步决策与执行”。

## Skill

理解为把可复用的步骤、规范、脚本和参考资料打包封装，类似于菜谱 ——

假设LLM是厨师，今晚想要做一份土豆牛肉盖饭，刚好发现自己有这份菜谱，于是加载这份 Skill，并让模型按照里面的步骤、规范和参考资料完成任务；并且在未来的某个时候，如果还需要做这种盖饭，也可以直接复用

所以 Skill 的重点不是“提供一个外部动作”，而是“告诉模型某类任务应该怎么做”。

启动时只读取 skill 名称和描述；当任务匹配 skill 描述时，再加载完整 Skill；额外脚本和参考资料只在需要时加载，这样比较节省上下文

## MCP

`Model Context Protocol`，说的蛮玄乎，实则就是一个Protocol，解决各个工具接入不标准的问题。

> [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools.

再引用一段 [MCP](https://modelcontextprotocol.io/) 手册上的一段话，说的挺好，就是让不同工具、数据源、应用可以用同一套方式接入 LLM 应用的协议层。

所以 ——

Tool 是能力本身；
MCP 是暴露这些能力的协议。

## Context、RAG 和 Memory  
  
LLM 并不是直接面对整个世界，它只能看到当前上下文窗口里的内容。  
  
Context 包括：  
  
- system prompt；  
- user prompt；  
- 历史对话；  
- tool descriptions；  
- skill instructions；  
- tool results；  
- 检索到的文档；  
- memory 中取出的信息。  
  
RAG 和 Memory 都是在给模型补充上下文，但二者不一致 ——
  
RAG 主要解决“查资料”的问题。系统先从文档库、数据库等 当中检索相关内容，再把这些内容放进上下文，让模型基于资料回答，以减少幻觉（开卷考试，之前有说过
  
Memory 主要解决“长期记住”的问题。比如用户偏好、长期项目背景、历史决策等。Memory 本身不在上下文中，只有当系统把相关 memory 取出来放进当前上下文时，模型这次才真正看见它。

## Workflow / Graph

当然，如果所有的多步 LLM 系统全交给它自主决策，可能会很不稳定（概率模型是这样的）

于是对于某些明确的工作流，通常会使用 Workflow 进行编排，比如 ——

```text  
读取输入  
↓  
分析内容  
↓  
调用工具  
↓  
检查结果  
↓  
输出报告
```

就是一个比较经典的工作流

那么如果需要更复杂的，多状态转移，就使用 Graph 来进行表示即可

## 综上所述

LLM 是 Agent 的推理核心，但它本身不能直接操作外部世界。  
  
Tool 提供外部能力，例如搜索、读写文件、执行代码、查询数据库。  
  
Agent Runtime 负责把用户目标、上下文、工具、状态和模型调用组织成一个循环：模型判断下一步，必要时发起工具调用，工具结果再回到上下文，模型继续推理，直到完成任务。  
  
Skill 是某类任务的可复用方法包，类似菜谱，用来告诉模型遇到特定任务时应该按什么流程做。  
  
MCP 是工具和外部资源的标准接入协议，不是 Agent 本身，也不是工具本身。它让不同 LLM 应用能用统一方式接入外部工具、资源和提示模板。  
  
RAG、Memory、Context 则负责给模型提供信息；Workflow、Graph 等负责让 Agent 的执行过程更可控、更安全、更有可维护性。
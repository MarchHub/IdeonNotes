---
title: HTTP基础
tags: []
date: 2025-08-10
---
# HTTP基础

HTTP：超文本传输协议（HyperText Transfer Protocol），属于应用层协议，最早用于传输HTML，后来可以传输各种资源。

## 请求-响应 模型

一般需要经历如下过程：
1. 建立连接
2. 发送请求
3. 处理请求
4. 发送响应
5. 关闭连接

简单来说，就是客户端向服务器发送请求（request），服务端收到请求后返回对应资源。

## 报文结构

报文（Message），分为请求报文和响应报文。

请求报文结构：
- 请求行：一般包含请求方法、请求目标、版本号
- 请求头：使用`Key:Value`的结构，用于描述各种状态、信息
- 空行：在最后一个请求头后，通知服务器以下不再有请求头
- 消息体：可选，比如GET就不可能有；但是POST就有

其中常见的请求头
- Host：指定目标主机和端口
- User-Agent：客户端标识
- Accept、Accept-Encoding：期望接收的数据类型和编码
- Content-Type、Content-Length：请求体格式与长度
- Authorization：携带认证凭证（如 Token、Basic Auth）

示例：
```text
GET /api/users?page=2 HTTP/1.1
Host: example.com
Accept: application/json
User-Agent: Go-http-client/1.1
```

响应报文结构：
- 状态行：包含协议版本、状态码等信息
- 响应头：类似请求头，也是键值对，用于描述状态等
- 空行：
- 消息体：服务端返回给客户端的资源等

其中常见的响应头
- Content-Type、Content-Length：响应体格式与长度
- Cache-Control、Expires、ETag：缓存控制
- Set-Cookie：服务器向客户端写入 Cookie
- Connection：连接管理（keep-alive、close）

示例：
```text
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 48

{"page":2,"users":[{"id":1,"name":"Alice"}]}

```

## HTTP 方法

| 方法      | 用途      | 安全性 | 幂等性 | 请求体 | 典型场景           |
| ------- | ------- | --- | --- | --- | -------------- |
| GET     | 读取资源    | 安全  | 幂等  | 否   | 列表/详情查询        |
| POST    | 创建/提交   | 不安全 | 非幂等 | 有   | 新建、表单提交        |
| PUT     | 完整更新    | 不安全 | 幂等  | 有   | 整体替换资源         |
| PATCH   | 局部更新    | 不安全 | 可幂等 | 有   | 修改部分字段         |
| DELETE  | 删除资源    | 不安全 | 幂等  | 否   | 删除操作           |
| HEAD    | 读取头部    | 安全  | 幂等  | 否   | 资源存在校验、缓存预检    |
| OPTIONS | 查询支持选项  | 安全  | 幂等  | 否   | CORS 预检、API 探测 |
| CONNECT | 建隧道（代理） | 不安全 | 非幂等 | 否   | HTTPS 代理隧道     |
| TRACE   | 回显请求    | 不安全 | 幂等  | 否   | 调试（通常禁用）       |

## HTTP 状态码

收集常用

| 类别  | 状态码 | 含义        |
| --- | --- | --------- |
| 1xx | 100 | 继续（继续发送）  |
|     | 101 | 升级（切换协议）  |
| 2xx | 200 | 请求成功      |
|     | 201 | 已创建       |
|     | 204 | 无内容       |
| 3xx | 301 | 永久重定向     |
|     | 302 | 临时重定向     |
|     | 304 | 未修改（可用缓存） |
| 4xx | 400 | 错误请求      |
|     | 401 | 未授权       |
|     | 403 | 禁止访问      |
|     | 404 | 未找到       |
| 5xx | 500 | 服务器内部错误   |
|     | 502 | 错误网关      |
|     | 503 | 服务不可用     |

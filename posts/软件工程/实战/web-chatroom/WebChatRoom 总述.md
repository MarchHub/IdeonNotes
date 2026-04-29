---
title: WebChatRoom 总述
tags:
  - golang
  - 后端
  - 网络
date: 2025-08-13
---
# 总述

结合一点所学，使用`golang`做后端实现多用户聊天室 (WebSocket 聊天服务)

慢慢更新内容

## 大体实现

- 用户系统
    - 注册 / 登录
    - 用户信息存储（调Mysql）    
- WebSocket 实时通信
    - Hub（消息集中调度）
    - Client（单个连接管理）
    - 房间管理（可选多房间 / 群聊）
- 中间件
    - JWT 认证
    - CORS、日志、限流
- 并发与超时
    - 利用 `context.Context` 管理连接生命周期
    - Ping/Pong 心跳检测

## 项目结构

```text
web-chatroom/                 // 项目根目录
├─ cmd/
│  └─ server/
│    └── main.go
│          
├─ config/                    // 存放配置文件
│  └── config.yaml
│      
└─ internal/
   ├─ config/                 // 配置文件的操作
   │  └── config.go
   │      
   ├─ db/                     // 定义数据库操作
   │  │── auth.go
   │  │── db.go
   │  └── model.go
   │      
   ├─ handler/                // 逻辑处理，路由绑定
   │  │── auth.go
   │  └── ws.go
   │      
   ├─ hub/                    // Web-Socket 客户端
   │  │── client.go
   │  └── hub.go
   │      
   └─ middleware/             // 中间件
	   └── auth.go
```

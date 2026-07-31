---
title: Gin 基础使用
tags:
  - Go
  - 后端开发
date: 2025-08-13
---
# Gin 基础使用

方便，性能不错，挺好

## 创建路由引擎

提供
- `gin.New()`：完全空白的纯净引擎（按需挂载中间件）
- `git.Default()`：提供默认的两种中间件
	- `Logger`：记录请求日志
	- `Recovery`：捕获`panic`并返回`500`

## 中间件使用

注册中间件 —— `r.Use(中间件)`

比如常见的`CORS`（跨域资源共享）中间件
```go
r.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"http://localhost:3000"},
    AllowMethods:     []string{"GET","POST","PUT","DELETE","OPTIONS"},
    AllowHeaders:     []string{"Authorization","Content-Type"},
    AllowCredentials: true,
    MaxAge:           12 * time.Hour,
}))
```

或者自定义 —— 要求自定义中间件需返回 `gin.HandlerFunc`，在函数体内写入前置逻辑（`Before`）和后置逻辑（`After`）。
```go
func MyMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
      // Before：请求进入时执行
      start := time.Now()
  
      c.Next() // 调用后续中间件和业务 Handler
  
      // After：Handler 执行完毕后执行
      duration := time.Since(start)
      log.Printf("请求 %s 耗时 %v", c.Request.URL.Path, duration)
    }
}
r.Use(MyMiddleware())
```

中间件的控制流 ——
假设定义了`c *gin.Content`，则有 ——

- `c.Next()` 继续执行后续中间件和最终 Handler。
- `c.Abort()` / `c.AbortWithStatus(code)` 停止执行剩余中间件及 Handler，直接返回。
- `c.AbortWithStatusJSON(code, obj)` 一步设置状态码、JSON 响应并中止后续处理。

例子：
```go
func Auth() gin.HandlerFunc {
    return func(c *gin.Context) {
      token := c.GetHeader("Authorization")
      if token == "" {
        c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
        return
      }
      c.Next()
    }
}
```

## 路由

最核心的功能了吧

### 基本方法注册

- `r.POST`
- `r.GET`
- `r.PUT`
- `r.DELETE`

等等，都支持。
也提供通配方法`r.Any()`，即可以匹配`post`，`put`等 HTTP 方法

只需要简单的使用`r.POST("/post", PostFunction)`即可把`/post`绑定上`PostFunction`，非常的方便

接着后面传入的`handler`——
```go
func Handler(c *gin.Content) {
	...
}
```

其中，`gin.Content`包含请求和响应的所有信息和方法，非常的好使
### 带参数注册

命名参数（只匹配单段路径，不含 `/`）：
 ```go
r.GET("/users/:id", func(c *gin.Context) {
    id := c.Param("id")
    c.String(200, id)
})
```

通配参数（匹配多层路径，含 `/`）：
```go
r.GET("/files/*filepath", func(c *gin.Context) {
    fp := c.Param("filepath")   // 如 /files/images/1.png -> /images/1.png
    c.String(200, fp)
})
```

### 分组

创建分组后，会自动在该组的路由前加入前缀。比如 ——
```go
api := r.Group("/api", AuthMiddleware())
api.GET("/profile", profileHandler)
api.POST("/posts", createPostHandler)
```
其中`profile`的地址就是`/api/profile`

在有分组的情况下，可以针对一个组来添加中间件，其执行顺序为
Gin 执行顺序： 全局 → 分组 → 单路由 → Handler → 单路由 After → 分组 After → 全局 After
语法：
- `group.Use(middleware)`：分组中间件
- `r.Use(middleware)`：全局中间件
- `r.GET("/admin", AuthMiddleware(), AdminHandler)`：单一中间件（就是在绑定路由的时候直接传入中间件）

## `gin.Content`

在 Gin 中，每个请求都会创建一个 `*gin.Context` 实例，承载了请求和响应的整个生命周期。可以把它看作封装了 `http.Request`、`http.ResponseWriter` 以及路由参数、上下文存储、错误列表等功能的统一入口。

### 主要字段

虽然 `gin.Context` 本身是一个结构体，许多字段并不对外公开，常用的公开字段和方法包括：
- `c.Writer`
    - 类型：`gin.ResponseWriter`
    - 封装了底层 `http.ResponseWriter`，提供状态码、写入字节数等方法。
- `c.Request`
    - 类型：`*http.Request`
    - 底层原生请求，可直接访问 URL、Header、Body、Context 等。
- `c.Params`
    - 类型：`gin.Params`（切片）
    - 存储路径中定义的命名参数，如 `/users/:id` 中的 `id`。
- `c.Keys`
    - 类型：`map[string]interface{}`
    - 由 `c.Set(key, value)` 初始化并存放，跨中间件/Handler 共享数据。
- `c.Errors`
    - 类型：`gin.Errors`
    - 在中间件或 Handler 中记录错误信息，方便统一处理。

### 数据

- 获得路径参数：假设有路由`/user/:id`，则可以使用`id := c.Param("id")`获取参数
- 查询参数（GET）
	- `c.Query("key")`：匹配路由下`?key=value`中的`key->value`，如果不存在则返回空字符串
	- `c.DefaultQuery("key", "defaultData")`，一样的匹配，只是如果不存在则返回`defaultData`
- 表单字段（POST）
	- `c.PostForm("name")`
	- `c.DefaultPostForm("name", "defaultName")`
- JSON

```go
type Req struct {
    Name string `json:"name" binding:"required"`
    Age  int    `json:"age" binding:"gte=0"`
}
var req Req
if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(400, gin.H{"error": err.Error()})
    return
}
```

### 响应

`c.JSON`，非常的常用！把自己的数据序列化成`JSON`形式，然后再写入`HTTP Response`

看下定义——
```go
func (c *Context) JSON(code int, obj interface{})
```

也就是我们需要传入状态码和任意可序列化对象（空接口可以用于匹配各种数据，非常棒）

使用示例：
```go
// 普通的使用
c.JSON(200, gin.H{
	"message": "success",
	"time":    time.Now().Format(time.RFC3339),
})

type UserResponse struct {
    ID       uint   `json:"id"`
    Name     string `json:"name"`
    Email    string `json:"email"`
    JoinedAt string `json:"joined_at"`
}

// 返回自定义数据类型
func GetProfile(c *gin.Context) {
    user := UserResponse{
        ID:       123,
        Name:     "alice",
        Email:    "alice@example.com",
        JoinedAt: time.Now().Add(-24 * time.Hour).Format(time.RFC3339),
    }
    c.JSON(200, user)
}
```

顺带一提——`gin.H`其实就是`map[string]interface{}`

还有字符串和二进制可以作为响应数据
```go
c.String(200, "hello %s", name)
c.Data(200, "application/octet-stream", blob)
```

更多的，假设存在HTML模板——
```go
// 加载模板
r.LoadHTMLGlob("templates/*")
// 返回渲染后的模板
c.HTML(200, "index.tmpl", gin.H{"title": "Home"})
```

返回文件——
```go
c.File("./public/image.png")           // 直接返回文件
```
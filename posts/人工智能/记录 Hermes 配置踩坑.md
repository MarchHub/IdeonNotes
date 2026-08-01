# 记录 Hermes 配置踩坑

尝试接入 QQ Bot, 遇到一些小问题, 顺手记录一下

## DM 中的文件

### 数据链路

在私信 Bot 的时候, 单独发送一个文件也会被视作一条消息被介入处理. 此时由于我们其实并未说明我们想要对这个文件做什么操作(比如分析啊,列大纲啊,什么之类的),所以相当于仅仅给 Agent 发送文件但是没有任何 User Prompt, 这显然不是我们想要的结果.

理想中的消息链路应当是 ——

1. 上传文件(因为 QQ 上不能把文件和文本消息合并成一条发送)
2. 等待用户输入要求
3. 执行

我们聚焦到`adapter.py`中,可以发现,这个适配器会先把输入消息进行一次 dispatch, 那么我们的文件消息应该是会被分到 `await self._handle_c2c_message(...)` 这个语句中.

然后在其中会调用`_process_attachments`处理附件,此时如果没有输入文字,就会把附件信息插入到信息中,最后再交付给`handle_message`实现

所以我们需要在此处做一次拦截 ——

- 接收到纯附件的时候仅做文件上传,但是不启动 Agent
- 在用户发送文本指令的时候取出文件信息做拼接然后再 Handle

### patch

我们在 `__init__` 中添加成员变量 `_pending_c2c_attachments` 用于存储上传的附件信息

```json
{
    "user_openid": {
        "attachment_info": "[file: paper.pdf (/local/path)]",
        "expires_at": 123456.0,
        "message_id": "qq-message-id",
        "count": 1,
    }
}
```

大概是这样的数据结构

说明了什么用户在什么时候上传了什么文件,文件什么时候过期,有几条文件信息

值得注意的是, Adapter 的生命周期是随着 Gateway 的,而不是每次构造,所以可以把这种信息暂时存放在 Adapter 中

接着我们在 `attachment_info` 尚未进入 `MessageEvent` 的时候做一个拦截 —— “当遇到纯消息传输消息的时候,暂存到 `_pending_c2c_attachments` 中” ( 其中 expires_at 是消息上传到时间加上手动设的ttl ),最后直接return,不让它进入 Agent 的消息处理

那么继续消息处理 —— 当用户新发送消息进入 `_handle_c2c_message` 当时候,如果查询到有尚未消费掉的待处理文件,就把文件信息拼接到此次用户的消息中,然后pop掉当前的文件 —— 不过实际上此处有一个设计上的差异 —— 用户上传文件并起传输指令究竟是一次性还是一段时间的事情?(不过这部分理解丢给 Agent 块做分析实际上其实没什么问题)


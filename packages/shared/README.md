# @twikoojs/shared

Twikoo 2.0 的**前后端共享类型与常量**：25 个后端事件名、版本占位符、pushoo 推送渠道等。

一般不需要单独安装 —— 它会作为 `twikoo`、`@twikoojs/common` 的依赖被自动带上。

- 官网与文档：<https://twikoo.js.org>
- 部署 Twikoo（选平台、按步骤做）：<https://twikoo.js.org/backend.html>
- 事件清单与语义：<https://twikoo.js.org/api.html>

## 用法

```js
import { COMMENT_SUBMIT, GET_FUNC_VERSION, PUSHOO_CHANNELS } from "@twikoojs/shared";
```

写自定义集成（例如自建后端、第三方客户端）时，事件名一律从这里取，
不要手写字符串 —— 服务端分发器与契约测试都以这份常量为准。

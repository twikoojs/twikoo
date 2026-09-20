# @twikoojs/common

Twikoo 2.0 的**服务端公共逻辑库**：ports 契约、pipeline + 事件分发、4 种数据库实现
（Mongo / Loki / Blob KV / CloudBase）、handlers / services、capabilities 与惰性重依赖加载。

它**不直接部署** —— 各平台适配器（`twikoo-func`、`twikoo-vercel`、`twikoo-netlify`、`tkserver` 等）
依赖它，并把平台能力注入进来。

- 官网与文档：<https://twikoo.js.org>
- 部署 Twikoo（选平台、按步骤做）：<https://twikoo.js.org/backend.html>
- 事件与 API：<https://twikoo.js.org/api.html>

## 用法

```js
import { createHandler } from "@twikoojs/common";

// 启动期装配一次：注入适配器聚合端口（TkAdapters）
const handleRequest = createHandler({
  request, // 平台载荷 → TkRequest
  response, // TkResponse → 平台返回体
  database, // 数据库实现之一
  storage, // Cap 验证码存储
  mailer,
  notifier,
  postSubmit, // 后置副作用派发（垃圾检测 + 通知）
  capabilities, // 该平台支持的能力（八项）
});

// 逐请求调用
const response = await handleRequest(request);
```

写自己的平台适配器时，用 `scaffoldAdapters` 兜底未实现的端口、`FULL_CAPABILITIES` 声明全能力；
具体约定见仓库 `AGENTS.md` 的「适配器开发指南」。

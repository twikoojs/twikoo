# @twikoojs/cloudflare-workers

Twikoo 2.0 Cloudflare Workers 适配器。业务逻辑在 `@twikoojs/common`，本包负责
Workers `fetch` 入口、MongoDB 环境变量、HTTP 载荷转换和平台生命周期。

## 部署

在自己的 Workers 工程中安装本包，并使用模块 Worker 入口：

```sh
pnpm add @twikoojs/cloudflare-workers
```

```ts
import twikoo from "@twikoojs/cloudflare-workers";

export default twikoo;
```

`wrangler.toml` 至少启用 Node.js 兼容层：

```toml
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2026-01-01"
main = "src/index.ts"
```

通过 Wrangler Secret 配置 `MONGODB_URI`；可选环境变量 `MONGODB_DB_NAME` 覆盖连接串中的数据库名：

```sh
wrangler secret put MONGODB_URI
wrangler secret put MONGODB_DB_NAME
wrangler deploy
```

## 数据库生命周期

Workers 适配器**不会跨请求复用 MongoDB 连接**：每次 `fetch` 创建一个数据库实例，公共管道完成
`init()` 后处理请求，随后在 `finally` 中调用 `close()`。连接失败、业务异常和响应已生成时也会执行关闭，
避免连接泄漏；这与 Workers 中手动维护连接生命周期的要求一致。
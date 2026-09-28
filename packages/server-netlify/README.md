# twikoo-netlify

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（Netlify）

1. Netlify → New site → 导入仓库（Functions 目录 `netlify/functions`）
2. 环境变量：`MONGODB_URI`（必填）
3. 前端配置 API 地址为 `https://<site>.netlify.app/.netlify/functions/twikoo`

## 平台核对清单（查阅日期 2026-09-28）

- [x] 现代 Functions 默认入口（`Request` / `Response`）通过 `withLambda` 复用事件归一化
- [x] `context.waitUntil()` 托管 POST_SUBMIT 自调用，响应不等待垃圾检测与通知
- [x] 保留 Functions v1 `handler` 具名导出；旧部署壳继续兼容并使用 5 秒有界等待
- [x] IP 头 `x-nf-client-connection-ip`（适配器已按此头提取，回退 x-real-ip/x-forwarded-for）
- [ ] 构建期 Node 版本对函数运行时的影响实测（人工项）

## 注意

- 独立适配器：直接依赖 @twikoojs/common，**不依赖 twikoo-vercel**（用户决策）

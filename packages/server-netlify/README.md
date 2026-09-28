# twikoo-netlify

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（Netlify）

1. Netlify → New site → 导入仓库（Functions 目录 `netlify/functions`）
2. 环境变量：`MONGODB_URI`（必填）
3. 前端配置 API 地址为 `https://<site>.netlify.app/.netlify/functions/twikoo`

## 升级兼容性

> [!WARNING]
> 现代模板依赖本包的默认导出。必须先发布包含现代入口的 `twikoo-netlify`，再升级部署模板；顺序颠倒会导致部署失败。

| `twikoo-netlify` 包 | 部署模板 | 结果 |
| --- | --- | --- |
| 旧版 | 旧模板 `require(...).handler` | 正常运行，通知同步等待，最长约 5 秒 |
| 新版 | 旧模板 `require(...).handler` | 功能兼容，但仍走同步兼容路径，最长约 5 秒 |
| 旧版 | 新模板 ESM 默认入口 | **不兼容**：旧包没有 `default` 导出，构建或部署失败 |
| 新版 | 新模板 ESM 默认入口 | 正常运行，通过 `context.waitUntil()` 异步派发通知 |

发布和升级必须遵循以下顺序：

1. 合并并发布本包的新版本。
2. 使用旧模板验证新版包的 `handler` 兼容性。
3. 将模板依赖更新到已发布的新版本，再切换 ESM 默认入口。
4. 验证浏览器响应耗时和后台通知后，再发布模板更新。

旧模板不会自动启用异步派发；仅升级 npm 包不会改善评论提交耗时。

## 平台核对清单（查阅日期 2026-09-28）

- [x] 现代 Functions 默认入口（`Request` / `Response`）通过 `withLambda` 复用事件归一化
- [x] `context.waitUntil()` 托管 POST_SUBMIT 自调用，响应不等待垃圾检测与通知
- [x] 保留 Functions v1 `handler` 具名导出；旧部署壳继续兼容并使用 5 秒有界等待
- [x] IP 头 `x-nf-client-connection-ip`（适配器已按此头提取，回退 x-real-ip/x-forwarded-for）
- [ ] 构建期 Node 版本对函数运行时的影响实测（人工项）

## 注意

- 独立适配器：直接依赖 @twikoojs/common，**不依赖 twikoo-vercel**（用户决策）

# twikoo-netlify

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（Netlify）

1. Netlify → New site → 导入仓库（Functions 目录 `netlify/functions`）
2. 环境变量：`MONGODB_URI`（必填）
3. 前端配置 API 地址为 `https://<site>.netlify.app/.netlify/functions/twikoo`

运行时要求 Node.js **>= 22.12.0**，建议使用 **Node 24**（`@netlify/functions@6` 与
`@netlify/aws-lambda-compat@2` 的最低版本要求）。

## 不兼容升级说明

新版 Netlify 部署模板改用 Modern Netlify Functions 入口，以便通过
`context.waitUntil()` 异步派发 `POST_SUBMIT`。这次升级同时涉及函数入口和
Node.js 版本，旧部署不能只更新单个文件。

旧模板继续可以运行，但即使升级了新版 `twikoo-netlify`，仍会走旧
`require(...).handler` 兼容路径，评论提交最多仍可能被后置通知阻塞约 5 秒。

从旧模板升级时请同时完成以下修改：

1. 删除 `netlify/functions/twikoo.js`。
2. 新建 `netlify/functions/twikoo.mjs`：

   ```js
   export { default } from "twikoo-netlify"
   ```

3. 确保 `package.json` 使用新版 `twikoo-netlify`，并要求 Node.js >= 22.12.0。
4. 在仓库根目录增加 `.node-version`，内容为 `24`。
5. 在 Netlify 使用 **Clear cache and deploy site** 重新部署。

如果先切换新模板但仍安装旧版 `twikoo-netlify`，可能因缺少 Modern 默认入口而在
构建或函数加载阶段失败；如果项目显式固定了 Node 18/20，也需要同步升级 Node 版本。

详细升级步骤见 [版本更新文档](../../docs/update.md#针对-netlify-部署的更新方式)。

## 平台核对清单（查阅日期 2026-09-28）

- [x] 现代 Functions 默认入口（`Request` / `Response`）通过 `withLambda` 复用事件归一化
- [x] `context.waitUntil()` 托管 POST_SUBMIT 自调用，响应不等待垃圾检测与通知
- [x] 保留 Functions v1 `handler` 具名导出；旧部署壳继续兼容并使用 5 秒有界等待
- [x] IP 头 `x-nf-client-connection-ip`（适配器已按此头提取，回退 x-real-ip/x-forwarded-for）
- [x] 现代入口依赖要求 Node.js >= 22.12.0；部署模板建议固定 Node 24

## 注意

- 独立适配器：直接依赖 @twikoojs/common，**不依赖 twikoo-vercel**（用户决策）

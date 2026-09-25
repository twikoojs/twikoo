# @twikoojs/cloudflare

Twikoo 2.0 服务端适配器：**Cloudflare Workers + D1 / MongoDB**。业务逻辑全部在 `@twikoojs/common`，
本包只做平台入口、端口注入与载荷形态转换。

1.x 的 Cloudflare 支持来自独立仓库 [twikoojs/twikoo-cloudflare](https://github.com/twikoojs/twikoo-cloudflare)
（一份 1224 行的 `src/index.js`，自带 D1 SQL、邮件垫片、事件分发）。2.0 把业务逻辑收回
公共层后，本包是它的等价形态：

| 1.x 位置 | 2.0 归属 |
| --- | --- |
| `DBBinding`（D1 SQL 手写） | `src/database/d1.ts`（实现 `Database` 端口） |
| `setCustomLibs({ nodemailer })` | `src/mail/nodemailer.ts`（真实 SMTP + HTTP 通道） |
| `setCustomLibs({ DOMPurify: 直通 })` | 公共层的 jsdom + DOMPurify |
| `currentRequestGeo` | `src/geo/region-store.ts`（`request.cf` + 落库 `ipRegion`） |
| 各事件 handler（20 个） | `@twikoojs/common` 的 handlers（本包不碰） |
| `postSubmit` 5 秒竞速 | `src/dispatch.ts`（`ctx.waitUntil`） |

## 部署

1. 克隆本仓库并构建（需 Node.js 26 与 pnpm，递归构建适配器及其 workspace 依赖）：

   ```sh
   pnpm install
   pnpm -r --filter '@twikoojs/cloudflare...' build
   cd packages/server-cloudflare
   npx wrangler login
   ```

2. 在当前包目录创建 `wrangler.toml`：

   ```toml
   name = "twikoo"
   main = "dist/index.js"
   compatibility_date = "2026-09-01"
   compatibility_flags = ["nodejs_compat"]
   ```

   `nodejs_compat` 是必需的，MongoDB、SMTP 及公共层的 Node API 均依赖它。
   上述兼容日期与标志已用于本地 workerd 验证。构建会预打包真实 jsdom，避免 Wrangler 的
   `whatwg-url` 替换破坏 DOM 初始化；**不要跳过构建直接部署 `src/`**。
   在本包目录部署时，`main` 应为 `dist/index.js`，不是 `node_modules` 下的本包路径。

3. 选择数据库：

   **D1（默认）**：创建数据库，将输出的 ID 加入 `wrangler.toml`：

   ```sh
   npx wrangler d1 create twikoo
   ```

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "twikoo"
   database_id = "<上一步输出的 id>"
   ```

   可手动建表，也可由首次请求自动创建：

   ```sh
   npx wrangler d1 execute twikoo --remote --file=./schema.sql
   ```

   **MongoDB**：用 secret 保存连接串，不要把凭据写进 `wrangler.toml`：

   ```sh
   npx wrangler secret put MONGODB_URI
   ```

   按提示输入连接串。默认使用 URI 中的数据库名；需要覆盖时，在 `wrangler.toml` 添加：

   ```toml
   [vars]
   MONGODB_DB_NAME = "twikoo"
   ```

   非空的 `MONGODB_URI` 优先于 D1；使用 MongoDB 时无需 D1 绑定或建表命令。
   未配置或设为空串时仍使用 D1，不会在 MongoDB 连接失败时自动回退。

4. 部署：

   ```sh
   npx wrangler deploy
   ```

5. 浏览器访问部署出的地址，看到 `Twikoo 云函数运行正常…` 即成功；把它（含 `https://`）
   填到前端的 `envId`。

### 数据库生命周期

MongoDB 模式每个请求新建一个基于公共 `MongoDatabase` 的实例，不跨请求复用连接。请求的
`finally` 等待实际 `POST_SUBMIT` 后置任务全部结束（成功或失败），再关闭连接；有后台任务时通过
`waitUntil` 托管这段收尾流程。某一路通知失败也会等待其他通知完成。离线调用没有 `waitUntil` 时
会等待任务及关闭完成。显式注入 `createCloudflareFunc({ database })` 的数据库由调用方管理，
不会被自动关闭；D1 仍按绑定复用实例。后台执行仍受 Workers 的时间与 CPU 限制。

### 从 1.x twikoo-cloudflare 升级

D1 表形态与 1.x 对齐（`comment` 的 21 列、`counter`、单行 `config`），**既有数据可直接沿用**。
2.0 只多一列 `comment.extra`（承载扩展字段），`init()` 会自动 `ALTER TABLE` 补上；
若想手工做，执行：

```sql
ALTER TABLE "comment" ADD COLUMN "extra" TEXT NOT NULL DEFAULT '{}';
```

`cap_kv` 表是 2.0 新增的（内嵌 Cap 验证码存储），由 `init()` 自动创建。

## 能力（能力矩阵的 Cloudflare 行）

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| mail | ✅ | `nodejs_compat` 下的真实 Nodemailer SMTP；保留 SendGrid / MailChannels / Resend HTTP API |
| domPurify | ✅ | 公共层加载真实 jsdom + DOMPurify，不再使用 `xss` 垫片 |
| ip2region | ✅（覆写） | `request.cf` + 随评论落库的 `ipRegion`，不加载 IP 数据库 |
| akismet / tencentTms | ❌ | 仍未纳入本适配器的运行时支持范围 |
| imageUpload | ✅（覆写） | 原生 FormData 垫片 + S3 兼容图床 |
| qqAvatar | ✅ | 原生 fetch |
| ai | ✅ | `@xsai/generate-text` 调用 OpenAI 兼容接口 |

### 邮件通知

以下配置均在 **Twikoo 管理面板**中设置，不是新增的 Workers 环境变量。

- **SMTP**：配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASS`
  与 `SENDER_EMAIL`，并清空 `SMTP_SERVICE`（非空时优先使用服务预设）。Workers 禁止连接
  SMTP 端口 25；按服务商要求使用 465 + `SMTP_SECURE=true`（直接 TLS），或
  587 + `SMTP_SECURE=false`（服务端支持时通过 STARTTLS 升级）。公共层仅将字符串
  `"true"` 识别为启用直接 TLS。每次 `verify` / `sendMail` 独立创建并关闭
  `pool: false` 的 Nodemailer 传输器，不跨请求保留 SMTP 连接。
- **HTTP API**：显式将 `SMTP_SERVICE` 设为 `SendGrid` / `MailChannels` / `Resend`，
  API Key 填入 `SMTP_PASS`，`SMTP_USER` 需非空，`SENDER_EMAIL` 填发件地址。
  这些通道仍走 HTTP，不转为 SMTP；发送失败会抛出带 HTTP 状态码的错误。

### AI 垃圾评论检测

在 Twikoo 管理面板配置 `LLM_API_KEY`、`LLM_API_ENDPOINT` 与 `LLM_MODEL`，使用公共层的
AI 检测流程。接口需兼容 OpenAI；Akismet 与腾讯云内容审核仍关闭。

### 图片上传

用 **S3 兼容图床**：`IMAGE_CDN` 设为 `s3`，`S3_BUCKET` / `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` 填 R2 的 S3 凭据，`S3_ENDPOINT` 填
`https://<accountid>.r2.cloudflarestorage.com`，`S3_FORCE_PATH_STYLE` 留空或 `true`。
（1.x 那种「直接用 R2 绑定上传」的形态没有移植：2.0 的上传链路统一走
`UPLOAD_IMAGE` 服务，S3 协议已覆盖 R2；代价是**删除评论时不会连带删除 R2 图片**。）

### IP 属地

Cloudflare 的 `request.cf` 只描述**当前请求**的来源地，而 Twikoo 的 DTO 层是按评论落库时
记下的 `ip` 逐条算属地的。本适配器的做法是：请求入口记住「本次请求 IP → `request.cf` 属地」，
提交评论时把它写进 D1 或 MongoDB 的 `comment.ipRegion`，读取评论时再把库里的值
回填进进程内缓存；冷启动后仍能显示已有属地，1.x 时期存下的历史数据同样有效。
查询走 `setCustomLibs` 的覆写（`ip2region: true` 由它满足），不加载 ip2region 的 db。

## 测试

```sh
pnpm --filter @twikoojs/cloudflare test
```

- `test/database/d1.test.ts`：D1 端口实现（真 SQL，经 `node:sqlite` 替身跑），含语义查询
  六种形态、扩展字段往返、计数/配置/Cap KV，以及 **1.x 既有库的升级路径**；
- `test/main.test.ts`：端到端（Worker 入口 → pipeline → D1 → 响应），含 DOMPurify 消毒、属地
  落库与回填、`waitUntil` 派发、未绑定 D1 时的可读错误；
- `test/database/lifecycle.test.ts`：MongoDB 并发请求隔离、失败收尾、后台任务完成后关闭与注入库所有权；
- `test/database/mongo.test.ts`：属地持久化、缓存丢失后的回填与已有属地保留；
- `test/mail/smtp.test.ts`：真实本地 SMTP 会话、认证及收件人拒绝、连接关闭；
- `test/mail/nodemailer.test.ts`：HTTP 通道的请求载荷、认证校验与服务端错误；
- `test/geo/region-store.test.ts`、`test/form-data.test.ts`、`test/dispatch.test.ts`、
  `test/database/schema.test.ts`：各注入件的单测。

## 平台核对清单（查阅日期 2026-09-23）

- [x] Workers 模块入口 `export default { fetch }` 与 `(request, env, executionCtx)` 签名
- [x] `request.cf` 的字段面（country / region / city）与「仅当前请求」的限制
- [x] D1 binding API（`prepare/bind/first/all/run`、位置参数、`meta.changes`）
- [x] `ctx.waitUntil` 的后台执行窗口
- [x] 本地 workerd：D1 / MongoDB 评论读写、DOMPurify 消毒、xsai 请求及审核结果落库、SMTP 协议
- [x] Wrangler 4.138.0 `deploy --dry-run`：gzip 约 1.37 MiB（实际部署以当前构建结果为准）
- [ ] **真机部署实测**（`wrangler deploy` + 远程数据库、邮件服务商 TLS、R2 图片上传）

## 关于 npm 发布

本包当前 `private: true`（与 `packages/server-edgeone-makers` 一致，避免在发布流水线尚未配置
Trusted Publisher 时污染 `publish.yml` 的可见性 gate）。若要改为 npm 发布，需要三步：
从 `package.json` 去掉 `private`、把包登记进 `scripts/release-packages.mjs` 的
`PUBLISH_PACKAGES`（并更新「10 个包」的文案）、在 npmjs.com 上为该包配置 Trusted Publisher。

# @twikoojs/cloudflare

Twikoo 2.0 服务端适配器：**Cloudflare Workers + D1**。业务逻辑全部在 `@twikoojs/common`，
本包只做平台入口、端口注入与载荷形态转换。

1.x 的 Cloudflare 支持来自独立仓库 [twikoojs/twikoo-cloudflare](https://github.com/twikoojs/twikoo-cloudflare)
（一份 1224 行的 `src/index.js`，自带 D1 SQL、邮件垫片、事件分发）。2.0 把业务逻辑收回
公共层后，本包是它的等价形态：

| 1.x 位置 | 2.0 归属 |
| --- | --- |
| `DBBinding`（D1 SQL 手写） | `src/database/d1.ts`（实现 `Database` 端口） |
| `setCustomLibs({ nodemailer })` | `src/mail/nodemailer.ts`（HTTP 通道） |
| `setCustomLibs({ DOMPurify: 直通 })` | `src/dom-purify.ts`（`xss` 白名单消毒） |
| `currentRequestGeo` | `src/geo/region-store.ts`（`request.cf` + 落库 `ipRegion`） |
| 各事件 handler（20 个） | `@twikoojs/common` 的 handlers（本包不碰） |
| `postSubmit` 5 秒竞速 | `src/dispatch.ts`（`ctx.waitUntil`） |

## 部署

1. 克隆本仓库并构建（`@twikoojs/common` 与 `@twikoojs/shared` 需先产出 `dist/`）：

   ```sh
   pnpm install
   pnpm build
   cd packages/server-cloudflare
   ```

2. 建 D1 数据库并把 `database_id` 填进 `wrangler.toml`：

   ```sh
   npx wrangler d1 create twikoo
   ```

   一个最小的 `wrangler.toml`（`main` 指向本包的构建产物）：

   ```toml
   name = "twikoo"
   main = "node_modules/@twikoojs/cloudflare/dist/index.js"
   compatibility_flags = ["nodejs_compat"]
   compatibility_date = "2026-09-23"

   [[d1_databases]]
   binding = "DB"
   database_name = "twikoo"
   database_id = "<上一步输出的 id>"
   ```

   > `nodejs_compat` 是**必需**的：公共层的 `node:crypto` / `Buffer` 依赖它。
   > Workers 上也**不需要** `main` 之外的入口文件——`dist/index.js` 自带
   > `export default { fetch }`。

3. 建表（两条路，任选其一；云函数首次请求也会自己建）：

   ```sh
   npx wrangler d1 execute twikoo --remote --file=./schema.sql
   ```

4. 部署：

   ```sh
   npx wrangler deploy
   ```

5. 浏览器访问部署出的地址，看到 `Twikoo 云函数运行正常…` 即成功；把它（含 `https://`）
   填到前端的 `envId`。

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
| mail | ⚠️ 受限 | 仅 SendGrid / MailChannels / Resend 的 HTTP API（Workers 无裸 TCP SMTP） |
| domPurify | ❌ | 无 jsdom；改注入 `xss` 白名单垫片（评论消毒实际可用，1.x 同款） |
| ip2region | ✅（覆写） | `request.cf` + 随评论落库的 `ipRegion`，不装 8.33 MB 的 db |
| akismet / tencentTms | ❌ | 两个 SDK 依赖 Node `http` 与长连接，Workers 上不可用 |
| imageUpload | ✅（覆写） | 原生 FormData 垫片 + S3 兼容图床 |
| qqAvatar | ✅ | 原生 fetch |
| ai | ❌ | 未引入 `@xsai/*`（产物体积 + 待实测） |

### 邮件通知

配置 `SMTP_SERVICE` 为 `SendGrid` / `MailChannels` / `Resend`，并把服务商的 API Key 填到
`SMTP_PASS`（`SMTP_USER` 需非空，值本身不校验），`SENDER_EMAIL` 填发件地址。
发送失败会抛出带 HTTP 状态码的错误（1.x 直接 `return fetch(...)` 不看响应，
API Key 失效会被当成发送成功，这里修掉了）。

### 图片上传

用 **S3 兼容图床**：`IMAGE_CDN` 设为 `s3`，`S3_BUCKET` / `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` 填 R2 的 S3 凭据，`S3_ENDPOINT` 填
`https://<accountid>.r2.cloudflarestorage.com`，`S3_FORCE_PATH_STYLE` 留空或 `true`。
（1.x 那种「直接用 R2 绑定上传」的形态没有移植：2.0 的上传链路统一走
`UPLOAD_IMAGE` 服务，S3 协议已覆盖 R2；代价是**删除评论时不会连带删除 R2 图片**。）

### IP 属地

Cloudflare 的 `request.cf` 只描述**当前请求**的来源地，而 Twikoo 的 DTO 层是按评论落库时
记下的 `ip` 逐条算属地的。本适配器的做法是：请求入口记住「本次请求 IP → `request.cf` 属地」，
提交评论时把它写进 `comment.ipRegion`（1.x schema 本就有这一列），读取评论时再把库里的值
回填进进程内缓存 —— 于是同一条评论对**所有人**都能显示属地，1.x 时期存下的历史数据同样有效。
查询走 `setCustomLibs` 的覆写（`ip2region: true` 由它满足），不加载 ip2region 的 db。

## 测试

```sh
pnpm --filter @twikoojs/cloudflare test
```

- `test/database/d1.test.ts`：D1 端口实现（真 SQL，经 `node:sqlite` 替身跑），含语义查询
  六种形态、扩展字段往返、计数/配置/Cap KV，以及 **1.x 既有库的升级路径**；
- `test/main.test.ts`：端到端（Worker 入口 → pipeline → D1 → 响应），含 xss 消毒、属地
  落库与回填、`waitUntil` 派发、未绑定 D1 时的可读错误；
- `test/mail/nodemailer.test.ts`、`test/geo/region-store.test.ts`、`test/form-data.test.ts`、
  `test/dispatch.test.ts`、`test/database/schema.test.ts`：各注入件的单测。

## 平台核对清单（查阅日期 2026-09-23）

- [x] Workers 模块入口 `export default { fetch }` 与 `(request, env, executionCtx)` 签名
- [x] `request.cf` 的字段面（country / region / city）与「仅当前请求」的限制
- [x] D1 binding API（`prepare/bind/first/all/run`、位置参数、`meta.changes`）
- [x] `ctx.waitUntil` 的后台执行窗口
- [x] `nodejs_compat` 提供的 `node:crypto` / `Buffer`
- [ ] **真机部署实测**（`wrangler deploy` + 真实 D1 上的增删改查、邮件通道、R2 图片上传）
- [ ] Workers 免费套餐的产物体积上限核对（本包 `dist/index.js` 41.8 KB，依赖由 wrangler 打包）

## 关于 npm 发布

本包当前 `private: true`（与 `packages/server-edgeone-makers` 一致，避免在发布流水线尚未配置
Trusted Publisher 时污染 `publish.yml` 的可见性 gate）。若要改为 npm 发布，需要三步：
从 `package.json` 去掉 `private`、把包登记进 `scripts/release-packages.mjs` 的
`PUBLISH_PACKAGES`（并更新「9 个包」的文案）、在 npmjs.com 上为该包配置 Trusted Publisher。

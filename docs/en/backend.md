# Serverless deployment

| <div style="width: 10em">Deployment option</div> | Rating | Description                                                                                                             |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Tencent CloudBase (console)                      | ★★★☆☆  | Deploy to a Tencent CloudBase environment from the console. Fast inside mainland China. A paid environment is required. |
| Tencent Cloud CLI                                | ⛔     | **No longer supported since 2.0** (BC-14) — see below.                                                                  |
| Vercel                                           | ★★★☆☆  | Good free tier. Slower or unreachable from mainland China; bind your own domain to improve speed.                       |
| Netlify                                          | ★★★★☆  | Generous free tier and decent speed from mainland China.                                                                |
| AWS Lambda                                       | ★★★☆☆  | Best fit if you already use AWS.                                                                                        |
| EdgeOne Pages Makers                             | ★★☆☆☆  | Tencent Cloud EdgeOne. **Restricted capabilities**, see the matrix below.                                               |
| Self-hosted (Node / Docker)                      | ★★★☆☆  | For users with their own server; you need your own HTTPS certificate.                                                   |

> Step-by-step walkthroughs with screenshots are maintained in the Chinese documentation: [云函数部署](/backend).

## 2.0 adapters and capability matrix

Twikoo 2.0 splits the server side into **8 adapters**. All business logic lives in `@twikoojs/common`; each adapter only provides the platform entry point and dependency injection. Five of them are published to npm:

| Adapter                          | Package                 | Platform                | Capabilities           |
| -------------------------------- | ----------------------- | ----------------------- | ---------------------- |
| `packages/server-cloudbase`      | `twikoo-func`           | Tencent CloudBase       | full                   |
| `packages/server-vercel`         | `twikoo-vercel`         | Vercel                  | full                   |
| `packages/server-netlify`        | `twikoo-netlify`        | Netlify                 | full                   |
| `packages/server-self-hosted`    | `tkserver`              | own server / Docker     | full                   |
| `packages/server-aws-lambda`     | `twikoo-aws-lambda`     | AWS Lambda              | full                   |
| `packages/server-deta`           | `twikoo-deta`           | Deta Space              | full                   |
| `packages/server-edgeone-makers` | `twikoo-edgeone-makers` | EdgeOne Pages Makers    | **restricted**         |
| `packages/server-vercel-min`     | `twikoo-vercel-min`     | Vercel (thin forwarder) | reuses `twikoo-vercel` |

| Capability  | Meaning                       | Full adapters | EdgeOne Makers                                                                     |
| ----------- | ----------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| mail        | mail notifications            | ✅            | ⚠️ **restricted**: SendGrid / MailChannels only, or Go SMTP Bridge via `SMTP_HOST` |
| domPurify   | comment XSS sanitisation      | ✅            | ❌ pass-through (content stored as-is)                                             |
| ip2region   | IP region display             | ✅            | ✅                                                                                 |
| akismet     | Akismet anti-spam             | ✅            | ❌                                                                                 |
| tencentTms  | Tencent Cloud text moderation | ✅            | ❌                                                                                 |
| imageUpload | image upload                  | ✅            | ✅                                                                                 |
| qqAvatar    | QQ avatars                    | ✅            | ✅                                                                                 |
| ai          | LLM anti-spam                 | ✅            | ✅                                                                                 |

Restricted capabilities never break comment posting or rendering: a missing capability returns an explicit error message in the admin panel instead of failing silently.

::: warning Runtime version
On CloudBase, upgrade the function runtime to **Node 20 or newer (24 recommended)**. The 2.0 build targets ES2022 and no longer supports Node 16.13 (BC-3).
:::

## Tencent CloudBase (console)

1. Create a CloudBase environment and enable anonymous sign-in (环境 → 登录授权).
2. Add your site domain to the WEB security domains (环境 → 安全配置).
3. In 云函数 → 函数管理, create a function from the **Node.js Hello World** template.
4. Replace `index.js` with:

   ```js
   exports.main = require("twikoo-func").main;
   ```

5. Replace `package.json` with the following, then let the console install dependencies online (在线装依赖):

   ```json
   { "dependencies": { "twikoo-func": "^2.0.0-beta.1" } }
   ```

6. Name the function `twikoo`, create it, and wait until its status becomes normal. The `envId` is shown as `<environment name>-<random suffix>` — without the `https://` prefix.

## Command line deployment — no longer supported

::: danger Removed in 2.0
Twikoo **2.0 removes command line deployment** (BC-14): `tcb fn deploy` together with the `npm run deploy` / `login` / `logout` scripts and the `@cloudbase/cli` dependency are gone.

- Function behaviour is **not** affected, and the console workflow is unchanged;
- If you used `tcb fn deploy` or a custom CI script, switch to the console workflow described above;
- This section only documents the historical 1.x flow and **does not apply to 2.0**.
  :::

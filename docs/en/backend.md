# Serverless deployment

| <div style="width: 10em">Deployment option</div> | Rating | Description |
| ---- | ---- | ---- |
| Tencent CloudBase | ★★★☆☆ | Deploy to a Tencent CloudBase environment from the console. Fast inside mainland China. **Standard plan or above required**: on the free trial and personal plans the cloud function timeout is fixed at 3 seconds and cannot be changed, which cuts a comment submission off before it is stored. |
| Vercel | ★★★☆☆ | Good free tier. Slower or unreachable from mainland China; bind your own domain to improve speed. |
| Netlify | ★★★★☆ | Generous free tier and decent speed from mainland China. |
| AWS Lambda | ★★★☆☆ | Best fit if you already use AWS. |
| EdgeOne Makers | ★★☆☆☆ | Tencent Cloud EdgeOne. **Restricted capabilities**: email via limited channels only; no spam filtering or AI features. See the [adapter README](https://github.com/twikoojs/twikoo/tree/main/packages/server-edgeone-makers) for details. |
| Self-hosted (Node / Docker) | ★★★☆☆ | For users with their own server; you need your own HTTPS certificate. |

> Step-by-step walkthroughs with screenshots are maintained in the Chinese documentation: [云函数部署](/backend).

## Tencent CloudBase

::: warning Prerequisite: Standard plan or above
On the free trial and personal plans the function **timeout is fixed at 3 seconds and the memory at 256MB, neither changeable** (the console disables the field and shows a `个人版` tag). Posting a comment on a cold instance takes longer than 3 seconds, so the function is killed and the comment is never stored.
Standard plan and above allow raising the timeout up to 900 seconds.
:::

1. Create a CloudBase environment and enable anonymous sign-in (身份认证 → 配置 → 登录方式 → 允许匿名登入).
2. Add your site domain under HTTP 网关 → 跨域设置 → 添加跨域域名 (paid plans only).
3. In 云函数 → 函数管理，open the `⋮` menu to the right of `鉴权设置` and choose `权限控制（legacy）`, then replace the rule with:

```json
{
  "*": {
    "invoke": "auth != null"
  }
}
```

4. Still in 云函数 → 函数管理，create a function from the **Node.js Hello World** template.

> **Keep the runtime at the template default, Node.js 20.19.** Two runtimes must be avoided: **Node.js 24.11（公测中）** — measured to fail online dependency installation, leaving the function in a broken state (`[ResourceNotFound.Package] BuildCodeViaSCF Failed resp:null: Dependency error`, no code deployed); and **Node.js 18.15** — too old for dependencies such as `html-to-text` (requires ≥ 20.19).
5. Replace `index.js` with:

```js
exports.main = require("twikoo-func").main;
```

6. Replace `package.json` with the following, then let the console install dependencies online (在线装依赖):

```json
{ "dependencies": { "twikoo-func": "latest" } }
```

`latest` always points at the newest stable release, so upgrading is just hitting 保存并安装依赖 again — no version number to remember. Pin an explicit version instead if you prefer, at the cost of editing it on every upgrade.

7. Leave the other files unchanged. Name the function `twikoo`, expand `配置信息` and set `运行环境` to **Node.js 24.11（公测中）**, then click create. The `envId` is shown as `<environment name>-<random suffix>` — without the `https://` prefix.

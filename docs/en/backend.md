# Serverless deployment

| <div style="width: 10em">Deployment option</div> | Rating | Description |
| ---- | ---- | ---- |
| Tencent CloudBase | ★★★☆☆ | Deploy to a Tencent CloudBase environment from the console. Fast inside mainland China. A paid environment is required. |
| Vercel | ★★★☆☆ | Good free tier. Slower or unreachable from mainland China; bind your own domain to improve speed. |
| Netlify | ★★★★☆ | Generous free tier and decent speed from mainland China. |
| AWS Lambda | ★★★☆☆ | Best fit if you already use AWS. |
| EdgeOne Makers | ★★☆☆☆ | Tencent Cloud EdgeOne. **Restricted capabilities**: email via limited channels only; no spam filtering or AI features. See the [adapter README](https://github.com/twikoojs/twikoo/tree/main/packages/server-edgeone-makers) for details. |
| Self-hosted (Node / Docker) | ★★★☆☆ | For users with their own server; you need your own HTTPS certificate. |

> Step-by-step walkthroughs with screenshots are maintained in the Chinese documentation: [云函数部署](/backend).

## Tencent CloudBase

1. Create a CloudBase environment and enable anonymous sign-in (环境 → 登录授权).
2. Add your site domain to the WEB security domains (环境 → 安全配置).
3. In 云函数 → 函数管理，create a function from the **Node.js Hello World** template.
4. Replace `index.js` with:

```js
exports.main = require("twikoo-func").main;
```

5. Replace `package.json` with the following, then let the console install dependencies online (在线装依赖):

```json
{ "dependencies": { "twikoo-func": "latest" } }
```

`latest` always points at the newest stable release, so upgrading is just hitting 保存并安装依赖 again — no version number to remember. Pin an explicit version instead if you prefer, at the cost of editing it on every upgrade.

6. Name the function `twikoo`, create it, and wait until its status becomes normal. The `envId` is shown as `<environment name>-<random suffix>` — without the `https://` prefix.

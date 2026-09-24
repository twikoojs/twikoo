# twikoo-edgeone-makers 一键部署模板

由 `packages/server-edgeone-makers/scripts/build-zip.mjs` 生成，请勿手工修改 twikoo-edgeone-makers.zip。

在 EdgeOne Makers 控制台「创建项目 → 直接上传」时上传该 ZIP 即可创建云函数。
详细步骤见文档站「云函数部署 → EdgeOne Makers 部署」。

## ZIP 内容

| 路径 | 作用 |
| --- | --- |
| `cloud-functions/index.js` | 一行转发到 `@twikoojs/edgeone-makers`，映射到域名根路径 `/` |
| `package.json` | 声明 `@twikoojs/edgeone-makers: latest`，平台据此 `npm install` |

## 为什么这么小

平台会执行 `npm install` 并把函数打成单文件，因此实现不必塞进 ZIP。
依赖写 `latest`：升级 Twikoo 只需在项目里点「重新部署」，无需重新上传部署包。

## 为什么不含 index.html

静态资源与函数路由冲突时静态资源优先，根目录出现 `index.html` 会让 `/` 返回 HTML，
Twikoo 的 envId 随即失效。

# 版本更新

不同部署方式的更新方式也不同，请对号入座。更新部署成功后，请不要忘记同时更新前端的 Twikoo CDN 地址中的 `x.x.x` 数字版本号，使之与云函数版本号相同，然后部署网站。

## 针对腾讯云 CloudBase 部署的更新方式

登录[环境 - 云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击 twikoo，点击函数代码，打开 `package.json` 文件，确认依赖写的是 `"twikoo-func": "latest"`（1.x 时代这里写的是固定版本号，建议一并改成 `latest`，以后升级就不用再改），点击“保存并安装依赖”即可。

::: tip 提示
如果您的云函数是 1.0.0 之前的版本，因为 1.0.0 版本修改了部署步骤，请先参考[手动部署](#手动部署)，从第 5 步开始，重新创建云函数，再按照此步骤更新。

如果升级后出现无法读取评论列表，云函数报错，请在函数编辑页面，删除 `node_modules` 目录（删除需要半分钟左右，请耐心等待删除完成），再点击保存并安装依赖。如果仍然不能解决，请删除并重新创建 Twikoo 云函数。
:::

::: warning 运行时版本
CloudBase 请将云函数运行时升级到 **Node 20 及以上（推荐 24）**；2.0 产物语法目标为 ES2022，不再兼容 Node 16.13。
:::

## 针对 Vercel 部署的更新方式

::: tip 不需要改版本号
一键部署的依赖写的是 `twikoo-vercel@latest`（见 [`templates/vercel-min/package.json`](https://github.com/twikoojs/twikoo/blob/main/templates/vercel-min/package.json)），
重新部署即可拿到最新稳定版。

注意 Vercel 默认复用构建缓存，缓存命中时不会重新解析 `latest`——
**重新部署时取消勾选「Use existing Build Cache」**，否则依赖还是旧的。
:::

1. 进入 [Vercel 仪表板](https://vercel.com/dashboard) - twikoo - Deployments
2. 在最新一次部署右侧点击更多（三个点）- Redeploy
3. 在弹窗中取消勾选 Use existing Build Cache，点击 Redeploy
4. 部署完成后访问域名，如果环境配置正确，可以看到“Twikoo 云函数运行正常”的提示

## 针对 Railway 部署的更新方式

模板仓库 [`twikoojs/twikoo-zeabur`](https://github.com/twikoojs/twikoo-zeabur) 的依赖写的是 `tkserver@latest`，**不需要改版本号**。

1. 登录 Github，找到部署时 fork 到自己账号下的名为 twikoo-zeabur 的仓库，点击 Sync fork 同步上游
2. 部署会自动触发；如果没有触发、或更新后版本没变，到 Railway 控制台手动重新部署一次

::: tip 如果你的 fork 里写的是固定版本号
把 `package.json` 里的 `"tkserver": "x.x.x"` 改成 `"tkserver": "latest"`，以后就只需要同步 fork 再重新部署。
:::

## 针对 Netlify 部署的更新方式

::: warning Netlify Modern Functions 不兼容升级
新版 Netlify 部署模板将函数入口从旧的 CommonJS `exports.handler` 切换到
Modern Netlify Functions 的 ESM 默认入口，以便通过 `context.waitUntil()`
异步执行 `POST_SUBMIT`，避免邮件等后置通知阻塞评论提交。

这次升级同时涉及 **npm 依赖、函数入口和 Node.js 版本**，旧部署不能只修改其中一项：

- 只升级 `twikoo-netlify`、仍保留旧 `require(...).handler`：可以继续运行，但仍走同步兼容路径，评论提交最多可能继续等待约 5 秒。
- 只同步新版模板、但仍安装旧版 `twikoo-netlify`：可能因缺少 Modern 默认入口而在构建或函数加载阶段失败。
- 仍使用 Node 18/20：新版 Modern 入口依赖要求 Node.js **>= 22.12.0**。
- 旧 fork 同步上游时，`twikoo.js` 删除并改为 `twikoo.mjs` 可能产生冲突；遇到冲突时按下面步骤手工调整即可。
:::

如果你的 Netlify 部署来自旧模板，请按以下步骤完成一次不兼容升级：

1. 登录 GitHub，打开部署时 fork 的 `twikoo-netlify` 仓库，先点击 **Sync fork**。如果同步产生冲突，可以跳过自动合并，按后续步骤手工修改。
2. 删除旧入口：

   ```text
   netlify/functions/twikoo.js
   ```

   新建：

   ```text
   netlify/functions/twikoo.mjs
   ```

   内容为：

   ```js
   export { default } from "twikoo-netlify"
   ```

3. 确认 `package.json` 至少包含：

   ```json
   {
     "dependencies": {
       "twikoo-netlify": "latest"
     },
     "engines": {
       "node": ">=22.12.0"
     }
   }
   ```

4. 在仓库根目录新建或更新 `.node-version`：

   ```text
   24
   ```

   如果你在 Netlify 项目中另外配置过 `NODE_VERSION`，也请确保版本不低于 22.12.0，建议统一使用 24。

5. 提交并推送以上修改。
6. 回到 Netlify 控制台，进入 **Deploys → Trigger deploy → Clear cache and deploy site**。必须清理缓存，确保 `latest` 被重新解析并安装。
7. 部署完成后访问云函数地址，确认能看到“Twikoo 云函数运行正常”的提示。
8. 再提交一条测试评论，确认评论可以快速返回，同时邮件 / 即时消息通知仍能正常收到。

::: tip 以后再升级
完成这次入口迁移后，后续正常升级只需要同步 `twikoo-netlify` 模板并重新部署即可。
如果依赖仍写为 `"twikoo-netlify": "latest"`，无需手工修改版本号。
:::

## 针对 Hugging Face 部署的更新方式

> 适用于所有 Docker Space。2026 年 7 月之后免费账号已无法创建新的 Space，详见[部署章节的前提说明](./backend.md#hugging-face-部署)。

1. 登录 Hugging Face，找到部署的 Space，点击上方 Settings，往下滚动找到并点击 Factory rebuild

## 针对私有部署的更新方式

1. 停止旧版本 `kill $(ps -ef | grep tkserver | grep -v 'grep' | awk '{print $2}')`
2. 拉取新版本 `npm i -g tkserver@latest`
3. 启动新版本 `nohup tkserver >> tkserver.log 2>&1 &`

## 针对私有部署 (Docker) 的更新方式

1. 拉取新版本 `docker pull imaegoo/twikoo`
2. 停止旧版本容器 `docker stop twikoo`
3. 删除旧版本容器 `docker rm twikoo`
4. [启动新版本容器](#私有部署-docker)

## 自动更新

考虑到可用性和安全性问题，Twikoo 没有实现自动更新，也没有计划实现自动更新。如果您希望实现自动更新，可以参考 MHuiG 基于 Github 工作流的 [twikoo-update](https://github.com/MHuiG/twikoo-update) 的实现方式。

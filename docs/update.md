# 版本更新

不同部署方式的更新方式也不同，请对号入座。更新部署成功后，请不要忘记同时更新前端的 Twikoo CDN 地址中的 `x.x.x` 数字版本号，使之与云函数版本号相同，然后部署网站。

## 针对腾讯云一键部署的更新方式

登录[环境-我的应用](https://console.cloud.tencent.com/tcb/apps/index)，输入

- 来源地址：`https://github.com/twikoojs/twikoo/tree/main`
- 部署分支：`main`

应用目录无需填写，点击“确定”，部署完成。

::: tip 不需要改版本号
一键部署的依赖写的是 `twikoo-func@latest`（见 [`templates/cloudbase/twikoo/package.json`](https://github.com/twikoojs/twikoo/blob/main/templates/cloudbase/twikoo/package.json)），
所以每次更新只要重新部署一次，就能拿到最新稳定版。

如果重新部署后版本没变，进入[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，
打开 `package.json` 点击一次“保存并安装依赖”，强制重装依赖。
:::

## 针对腾讯云手动部署的更新方式

登录[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击 twikoo，点击函数代码，打开 `package.json` 文件，确认依赖写的是 `"twikoo-func": "latest"`（1.x 时代这里写的是固定版本号，建议一并改成 `latest`，以后升级就不用再改），点击“保存并安装依赖”即可。

::: tip 提示
如果您的云函数是 1.0.0 之前的版本，因为 1.0.0 版本修改了部署步骤，请先参考[手动部署](#手动部署)，从第 5 步开始，重新创建云函数，再按照此步骤更新。

如果升级后出现无法读取评论列表，云函数报错，请在函数编辑页面，删除 `node_modules` 目录（删除需要半分钟左右，请耐心等待删除完成），再点击保存并安装依赖。如果仍然不能解决，请删除并重新创建 Twikoo 云函数。
:::

## 针对腾讯云命令行部署的更新方式

::: danger 2.0 起不再支持
Twikoo 2.0 移除了命令行部署（`tcb fn deploy` 与 `yarn deploy` / `login` / `logout` 脚本）。请改用[腾讯云手动部署的更新方式](#针对腾讯云手动部署的更新方式)（控制台修改 `package.json` 版本号 → 保存并安装依赖）。以下命令仅为 1.x 历史留档。
:::

进入 Twikoo 源码目录，执行以下命令更新现有的云函数

```sh
yarn deploy -e 您的环境id
```

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
4. 部署完成后访问域名，如果环境配置正确，可以看到 “Twikoo 云函数运行正常” 的提示

## 针对 Railway 和 Zeabur 部署的更新方式

模板仓库 [`twikoojs/twikoo-zeabur`](https://github.com/twikoojs/twikoo-zeabur) 的依赖写的是 `tkserver@latest`，**不需要改版本号**。

1. 登录 Github，找到部署时 fork 到自己账号下的名为 twikoo-zeabur 的仓库，点击 Sync fork 同步上游
2. 部署会自动触发；如果没有触发、或更新后版本没变，到 Railway / Zeabur 控制台手动重新部署一次

::: tip 如果你的 fork 里写的是固定版本号
把 `package.json` 里的 `"tkserver": "x.x.x"` 改成 `"tkserver": "latest"`，以后就只需要同步 fork 再重新部署。
:::

## 针对 Netlify 部署的更新方式

1. 登录 GitHub，找到部署时 fork 到自己账号下的名为 twikoo-netlify 的仓库
2. 确认 `package.json` 里的依赖写的是 `latest`（不是的话改成下面这样）

```json
{
  "dependencies": {
    "twikoo-netlify": "latest"
  }
}
```

::: tip 2.0 起只需要一个依赖
1.x 的 `twikoo-netlify` 复用了 `twikoo-vercel` 的实现，所以要同时写两个依赖；
2.0 起两者各自独立实现，只留 `twikoo-netlify` 即可。
:::

3. 点击 Sync fork 同步上游，然后在 Netlify 控制台 Deploys - Trigger deploy - **Clear cache and deploy site**（清缓存才会重新解析 `latest`）
4. 部署会自动触发

## 针对 Hugging Face 部署的更新方式

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

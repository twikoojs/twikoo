# 版本更新

不同部署方式的更新方式也不同，请对号入座。更新部署成功后，请不要忘记同时更新前端的 Twikoo CDN 地址中的 `x.x.x` 数字版本号，使之与云函数版本号相同，然后部署网站。

## 针对腾讯云一键部署的更新方式

登录[环境-我的应用](https://console.cloud.tencent.com/tcb/apps/index)，输入

* 来源地址：`https://github.com/twikoojs/twikoo/tree/main`
* 部署分支：`main`

应用目录无需填写，点击“确定”，部署完成。

## 针对腾讯云手动部署的更新方式

登录[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击 twikoo，点击函数代码，打开 `package.json` 文件，将 `"twikoo-func": "x.x.x"` 其中的版本号修改为最新版本号，点击“保存并安装依赖”即可。

::: tip 提示
如果您的云函数是 1.0.0 之前的版本，因为 1.0.0 版本修改了部署步骤，请先参考[手动部署](#手动部署)，从第 5 步开始，重新创建云函数，再按照此步骤更新。

如果升级后出现无法读取评论列表，云函数报错，请在函数编辑页面，删除 `node_modules` 目录（删除需要半分钟左右，请耐心等待删除完成），再点击保存并安装依赖。如果仍然不能解决，请删除并重新创建 Twikoo 云函数。
:::

## 针对腾讯云命令行部署的更新方式

进入 Twikoo 源码目录，执行以下命令更新现有的云函数

``` sh
yarn deploy -e 您的环境id
```

## 针对 Vercel 部署的更新方式

1. 进入 [Vercel 仪表板](https://vercel.com/dashboard) - twikoo - Settings - Git
2. 点击 Connected Git Repository 下方的仓库地址
3. 打开 package.json，点击编辑
4. 将 `"twikoo-vercel": "latest"` 其中的 `latest` 修改为最新版本号。点击 Commit changes
5. 部署会自动触发，可以回到 [Vercel 仪表板](https://vercel.com/dashboard)，查看部署状态

## 针对 Railway 和 Zeabur 部署的更新方式

1. 登录 Github，找到部署时 fork 到自己账号下的名为 twikoo-zeabur 的仓库
2. 打开 package.json，点击编辑
3. 将 `"tkserver": "latest"` 其中的 `latest` 修改为最新版本号。点击 Commit changes
4. 部署会自动触发

## 针对 Netlify 部署的更新方式

1. 登录 Github，找到部署时 fork 到自己账号下的名为 twikoo-netlify 的仓库
2. 打开 package.json，点击编辑
3. 将 `"twikoo-netlify": "latest"` 其中的 `latest` 修改为最新版本号。点击 Commit changes
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

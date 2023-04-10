# 快速上手

Twikoo 分为云函数和前端两部分，部署时请注意保持二者版本一致。

* [云函数部署](#云函数部署)有 5 种方式，[一键部署](#一键部署)、[手动部署](#手动部署)、[命令行部署](#命令行部署)、[Vercel 部署](#vercel-部署)和[私有部署](#私有部署)。
* [前端部署](#前端部署)有 2 种方式，如果您的网站主题支持 Twikoo，您只需在配置文件中指定 Twikoo 即可；如果您的网站主题不支持 Twikoo，您需要修改源码手动引入 Twikoo 的 js 文件并初始化。

## 云函数部署

| <div style="width: 6em">部署方式</div> | 描述 |
| ---- | ---- |
| [一键部署](#一键部署) | [ 不建议 ] 虽然方便，但是仅支持按量计费环境——也就是说，**一键部署的环境，当免费资源用尽后，将会产生费用**。且按量计费环境无法切换为包年包月环境。免费额度数据库读操作数只有 500 次 / 天，**无法支撑 Twikoo 的运行需求**。 |
| [手动部署](#手动部署) | [ 建议 ] 手动部署到腾讯云云开发环境，在中国大陆访问速度较快。需要付费购买环境才能部署。 |
| [命令行部署](#命令行部署) | [ 不建议 ] 仅针对有 Node.js 经验的开发者。 |
| [Vercel 部署](#vercel-部署) | [ 建议 ] 适用于想要免费部署的用户，在中国大陆访问速度较慢甚至无法访问。 |
| [Railway 部署](#railway-部署) | [ 建议 ] 有充足的免费额度，部署简单，适合全球访问。 |
| [Zeabur 部署](#zeabur-部署) | [ 建议 ] 有充足的免费额度，部署简单，适合中国大陆访问。 |
| [私有部署](#私有部署) | [ 建议 ] 适用于有服务器的用户，需要自行申请 HTTPS 证书。 |

### 一键部署

1. 点击以下按钮将 Twikoo 一键部署到云开发<br>
[![部署到云开发](https://main.qcloudimg.com/raw/67f5a389f1ac6f3b4d04c7256438e44f.svg)](https://console.cloud.tencent.com/tcb/env/index?action=CreateAndDeployCloudBaseProject&appUrl=https%3A%2F%2Fgithub.com%2Fimaegoo%2Ftwikoo&branch=main)
2. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
3. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”

### 手动部署

如果您打算部署到一个现有的云开发环境，请直接从第 3 步开始。

1. 进入[云开发CloudBase](https://curl.qcloud.com/KnnJtUom)活动页面，滚动到“新用户专享”部分，选择适合的套餐，点击“立即购买”，按提示创建好环境。
::: tip 提示
* 推荐创建上海环境。如选择广州环境，需要在 `twikoo.init()` 时额外指定环境 `region: "ap-guangzhou"`
* 环境名称自由填写
* 推荐选择计费方式`包年包月`，套餐版本`基础版 1`，超出免费额度不会收费
* 如果提示选择“应用模板”，请选择“空模板”
:::
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)<br>
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”
5. 进入[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击“新建云函数”
6. 函数名称请填写：`twikoo`，创建方式请选择：`空白函数`，运行环境请选择：`Nodejs 10.15`，函数内存请选择：`128MB`，点击“下一步”
7. 清空输入框中的示例代码，复制以下代码、粘贴到“函数代码”输入框中，点击“确定”
``` js
exports.main = require('twikoo-func').main
```
8. 创建完成后，点击“twikoo"进入云函数详情页，进入“函数代码”标签，点击“文件 - 新建文件”，输入 `package.json`，回车
9. 复制以下代码、粘贴到代码框中，点击“保存并安装依赖”
``` json
{ "dependencies": { "twikoo-func": "1.6.13" } }
```

### 命令行部署

::: warning 注意
* 请确保您已经安装了 [Node.js](https://nodejs.org/en/download/)
* 请将命令、代码中“您的环境id”替换为您自己的环境id
* 第 7 步会弹出浏览器要求授权，需在有图形界面的系统下进行
* 请勿在 Termux 下操作。虽然可以部署成功，但是使用时会报错 `[FUNCTIONS_EXECUTE_FAIL] Error: EACCES: permission denied, open '/var/user/index.js'`
:::

如果您打算部署到一个现有的云开发环境，请直接从第 3 步开始。

1. 进入[云开发CloudBase](https://curl.qcloud.com/KnnJtUom)活动页面，滚动到“新用户专享”部分，选择适合的套餐（一般 0 元套餐即可），点击“立即购买”，按提示创建好环境。
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)<br>
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”
5. 克隆本仓库
``` sh
git clone https://github.com/imaegoo/twikoo.git # 或 git clone https://e.coding.net/imaegoo/twikoo/twikoo.git
cd twikoo
```
> 如果您没有安装 Git，也可以从 [Release](https://github.com/imaegoo/twikoo/releases) 页面下载最新的 Source code<br>
> 如果您所在的地区访问 Github 速度慢，也可以尝试另一个仓库地址：[https://imaegoo.coding.net/public/twikoo/twikoo/git](https://imaegoo.coding.net/public/twikoo/twikoo/git)
6. 安装依赖项
``` sh
npm install -g yarn # 已安装 yarn 可以跳过此步
yarn install
```
7. 授权云开发环境（此命令会弹出浏览器要求授权，需在有图形界面的系统下进行）
``` sh
yarn run login
```
8. 自动部署
``` sh
yarn deploy -e 您的环境id
```

### Vercel 部署

::: warning 注意
Vercel 部署的环境需配合 1.4.0 以上版本的 twikoo.js 使用
:::

[查看视频教程](https://www.bilibili.com/video/BV1Fh411e7ZH)

1. 申请 [MongoDB](https://www.mongodb.com/cloud/atlas/register) 账号
2. 创建免费 MongoDB 数据库，区域推荐选择 `AWS / N. Virginia (us-east-1)`
3. 在 Clusters 页面点击 CONNECT，按步骤设置允许所有 IP 地址的连接（[为什么？](https://vercel.com/support/articles/how-to-allowlist-deployment-ip-address)），创建数据库用户，并记录数据库连接字符串，请将连接字符串中的 `<password>` 修改为数据库密码
4. 申请 [Vercel](https://vercel.com/signup) 账号
5. 点击以下按钮将 Twikoo 一键部署到 Vercel<br>
[![](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/imaegoo/twikoo/tree/main/src/server/vercel-min)
6. 进入 Settings - Environment Variables，添加环境变量 `MONGODB_URI`，值为第 3 步的数据库连接字符串
7. 进入 Deployments , 然后在任意一项后面点击更多（三个点） , 然后点击Redeploy , 最后点击下面的Redeploy
8. 进入 Overview，点击 Domains 下方的链接，如果环境配置正确，可以看到 “Twikoo 云函数运行正常” 的提示
9. Vercel Domains（包含 `https://` 前缀，例如 `https://xxx.vercel.app`）即为您的环境 id

### Railway 部署

::: warning 注意
Railway 部署的环境需配合 1.4.0 以上版本的 twikoo.js 使用
:::

1. 在 [Railway](https://railway.app/dashboard) 申请并登录账号，点击 New Project - Provision MongoDB，名称随意
2. 打开 [imaegoo/twikoo-zeabur](https://github.com/imaegoo/twikoo-zeabur) 点击 fork 将仓库 fork 到自己的账号下
3. 回到 Railway 点击 New - GitHub Repo - Configure GitHub App - 授权 GitHub - 选择刚才 fork 的仓库，等待部署完成
4. 点开环境卡片 - Variables - New Variable，左边输入 `PORT` 右边输入 `8080` 然后点 Add。
5. 点开环境卡片 - Settings - Environment - Domains，绑定一个域名（例如 `mytwikoo.up.railway.app`）
6. 到博客配置文件中配置 envId 为 `https://` 加域名（例如 `https://mytwikoo.up.railway.app`）

### Zeabur 部署

::: warning 注意
Zeabur 部署的环境需配合 1.4.0 以上版本的 twikoo.js 使用
:::

1. 在 [Zeabur](https://dash.zeabur.com) 申请并登录账号，点击部署新服务 - 部署其他服务 - 部署 MongoDB，名称随意
2. 打开 [imaegoo/twikoo-zeabur](https://github.com/imaegoo/twikoo-zeabur) 点击 fork 将仓库 fork 到自己的账号下
3. 回到 Zeabur 点击部署新服务 - 部署你的源代码 - 授权 GitHub - 选择刚才 fork 的仓库，名称随意
  > _无需配置数据库连接字符串！ Zeabur 已自动配置_
4. 部署好后点开环境卡片 - 设置 - 域名，绑定一个域名（例如 `mytwikoo.zeabur.app`）
5. 到博客配置文件中配置 envId 为 `https://` 加域名（例如 `https://mytwikoo.zeabur.app`）

### 私有部署

::: warning 注意
私有部署的环境需配合 1.6.0 或以上版本的 twikoo.js 使用
:::

1. 服务端下载安装 [Node.js](https://nodejs.org/zh-cn/)
2. 安装 Twikoo server: `npm i -g tkserver`
3. 根据需要配置环境变量

| 名称 | 描述 | 默认值 |
| ---- | ---- | ---- |
| `TWIKOO_DATA` | 数据库存储路径 | `./data` |
| `TWIKOO_PORT` | 端口号 | `8080` |
| `TWIKOO_THROTTLE` | IP 请求限流，当同一 IP 短时间内请求次数超过阈值将对该 IP 返回错误 | `250` |

4. 启动 Twikoo server: `tkserver`
5. 访问 `http://服务端IP:8080`
6. 若能正常访问，服务端地址（包含 `http://` 和端口号，例如 `http://12.34.56.78:8080`）即为您的环境 id

::: tip 提示
1. Linux 服务器可以用 `nohup tkserver >> tkserver.log 2>&1 &` 命令后台启动
2. 强烈建议配置前置 nginx 服务器并配置 https 证书
3. 数据在服务器上，请注意定期备份数据
:::

### 私有部署 (Docker)

```
docker run --name twikoo -e TWIKOO_THROTTLE=1000 -p 8080:8080 -v ${PWD}/data:/app/data -d imaegoo/twikoo
```

## 前端部署

### 在 Hexo 中使用

#### 在 [Hexo Butterfly](https://github.com/jerryc127/hexo-theme-butterfly) 主题使用

请参考 [Butterfly 安裝文檔(四) 主題配置-2](https://butterfly.js.org/posts/ceeb73f/#%E8%A9%95%E8%AB%96) 进行配置

#### 在 [Hexo Keep](https://github.com/XPoet/hexo-theme-keep) 主题使用

请参考 [hexo-theme-keep/_config.yml](https://github.com/XPoet/hexo-theme-keep/blob/master/_config.yml) 进行配置

#### 在 [Hexo Volantis](https://github.com/volantis-x/hexo-theme-volantis) 主题使用

请参考 [hexo-theme-volantis/_config.yml](https://github.com/volantis-x/hexo-theme-volantis/blob/master/_config.yml) 进行配置

#### 在 [Hexo Ayer](https://github.com/Shen-Yu/hexo-theme-ayer) 主题使用

请参考 [hexo-theme-ayer/_config.yml](https://github.com/Shen-Yu/hexo-theme-ayer/blob/master/_config.yml) 进行配置

#### 在 [Hexo NexT](https://github.com/next-theme/hexo-theme-next) 主题使用

**暂不支持 NexT 8 以下的版本**，请先升级到 NexT 8。然后在 Hexo 项目根目录执行

``` sh
# For NexT version >= 8.0.0 && < 8.4.0
npm install hexo-next-twikoo@1.0.0
# For NexT version >= 8.4.0
npm install hexo-next-twikoo@1.0.3
```

然后在配置中添加

``` yml
twikoo:
  enable: true
  visitor: true
  envId: xxxxxxxxxxxxxxx # 腾讯云环境填 envId；Vercel 环境填地址（https://xxx.vercel.app）
  # region: ap-guangzhou # 环境地域，默认为 ap-shanghai，腾讯云环境填 ap-shanghai 或 ap-guangzhou；Vercel 环境不填
```

#### 在 [Hexo Matery](https://github.com/blinkfox/hexo-theme-matery) 主题使用

请参考 [hexo-theme-matery/_config.yml](https://github.com/blinkfox/hexo-theme-matery/blob/develop/_config.yml) 进行配置

#### 在 [Hexo Icarus](https://github.com/ppoffice/hexo-theme-icarus) 主题使用

请参考 [基于腾讯云，给你的 Icarus 博客配上 Twikoo 评论系统](https://www.anzifan.com/post/icarus_to_candy_2/) by 异次元de机智君💯

#### 在 [Hexo MengD(萌典)](https://github.com/lete114/hexo-theme-MengD) 主题使用

请参考 [hexo-theme-MengD/_config.yml](https://github.com/lete114/hexo-theme-MengD/blob/master/_config.yml) 进行配置

#### 在 [hexo-theme-fluid](https://github.com/fluid-dev/hexo-theme-fluid) 主题使用

请参考 [配置指南-评论](https://hexo.fluid-dev.com/docs/guide/#%E8%AF%84%E8%AE%BA) 进行配置

#### 在 [hexo-theme-cards](https://github.com/ChrAlpha/hexo-theme-cards) 主题使用

请参考 [hexo-theme-cards/_config.yml](https://github.com/ChrAlpha/hexo-theme-cards/blob/master/_config.yml) 进行配置

#### 在 [maupassant-hexo](https://github.com/tufu9441/maupassant-hexo) 主题使用

请参考 [maupassant-hexo/_config.yml](https://github.com/tufu9441/maupassant-hexo/blob/master/_config.yml) 进行配置

#### 在 [hexo-theme-redefine](https://github.com/EvanNotFound/hexo-theme-redefine) 主题使用

请参考 [Redefine 官方文档 #comment](https://redefine-docs.ohevan.com/docs/configuration-guide/comment#twikoo) 进行配置

#### 在 [hugo-theme-stack](https://github.com/CaiJimmy/hugo-theme-stack) 主题使用

请参考 [Comments | Stack](https://stack.jimmycai.com/config/comments) 和 [hugo-theme-stack/config.yaml#L83](https://github.com/CaiJimmy/hugo-theme-stack/blob/master/config.yaml#L83) 进行配置

### 通过 CDN 引入

::: tip 提示
如果您使用的博客主题不支持 Twikoo，并且您不知道如何引入 Twikoo，您可以[在 Github 提交适配请求](https://github.com/imaegoo/twikoo/issues/new)
:::

``` html
<div id="tcomment"></div>
<script src="https://cdn.staticfile.org/twikoo/1.6.13/twikoo.all.min.js"></script>
<script>
twikoo.init({
  envId: '您的环境id', // 腾讯云环境填 envId；Vercel 环境填地址（https://xxx.vercel.app）
  el: '#tcomment', // 容器元素
  // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，腾讯云环境填 ap-shanghai 或 ap-guangzhou；Vercel 环境不填
  // path: location.pathname, // 用于区分不同文章的自定义 js 路径，如果您的文章路径不是 location.pathname，需传此参数
  // lang: 'zh-CN', // 用于手动设定评论区语言，支持的语言列表 https://github.com/imaegoo/twikoo/blob/main/src/client/utils/i18n/index.js
})
</script>
```

> 建议使用 CDN 引入 Twikoo 的用户在链接地址上锁定版本，以免将来 Twikoo 升级时受到非兼容性更新的影响。

#### 更换 CDN 镜像

如果遇到默认 CDN 加载速度缓慢，可更换其他 CDN 镜像。以下为可供选择的公共 CDN，其中一些 CDN 可能需要数天时间同步最新版本：

* `https://cdn.staticfile.org/twikoo/1.6.13/twikoo.all.min.js`
* `https://lib.baomitu.com/twikoo/1.6.13/twikoo.all.min.js`
* `https://cdn.bootcdn.net/ajax/libs/twikoo/1.6.13/twikoo.all.min.js`
* `https://cdn.jsdelivr.net/npm/twikoo@1.6.13/dist/twikoo.all.min.js`

## 开启管理面板（腾讯云环境）

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

配置好登录私钥之后无需留存私钥文件，请勿再次下载登录私钥，否则会导致之前配置的登录私钥失效。

## 开启管理面板（Vercel 环境）

点击评论窗口的“小齿轮”图标，设置管理员密码

## 版本更新

不同部署方式的更新方式也不同，请对号入座。更新部署成功后，请不要忘记同时更新前端的 Twikoo CDN 地址中的 `x.x.x` 数字版本号，使之与云函数版本号相同，然后部署网站。

### 针对一键部署的更新方式

登录[环境-我的应用](https://console.cloud.tencent.com/tcb/apps/index)，输入

* 来源地址：`https://github.com/imaegoo/twikoo/tree/main`
* 部署分支：`main`

应用目录无需填写，点击“确定”，部署完成。

### 针对手动部署的更新方式

登录[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击 twikoo，点击函数代码，打开 `package.json` 文件，将 `"twikoo-func": "x.x.x"` 其中的版本号修改为最新版本号，点击“保存并安装依赖”即可。

::: tip 提示
如果您的云函数是 1.0.0 之前的版本，因为 1.0.0 版本修改了部署步骤，请先参考[手动部署](#手动部署)，从第 5 步开始，重新创建云函数，再按照此步骤更新。

如果升级后出现无法读取评论列表，云函数报错，请在函数编辑页面，删除 `node_modules` 目录（删除需要半分钟左右，请耐心等待删除完成），再点击保存并安装依赖。如果仍然不能解决，请删除并重新创建 Twikoo 云函数。
:::

### 针对命令行部署的更新方式

进入 Twikoo 源码目录，执行以下命令更新现有的云函数

``` sh
yarn deploy -e 您的环境id
```

### 针对 Vercel 部署的更新方式

1. 进入 [Vercel 仪表板](https://vercel.com/dashboard) - twikoo - Settings - Git
2. 点击 Connected Git Repository 下方的仓库地址
3. 打开 package.json，点击编辑
4. 将 `"twikoo-vercel": "x.x.x"` 其中的版本号修改为最新版本号。点击 Commit changes
5. 部署会自动触发，可以回到 [Vercel 仪表板](https://vercel.com/dashboard)，查看部署状态

### 针对私有部署的更新方式

1. 停止旧版本 `kill $(ps -ef | grep tkserver | grep -v 'grep' | awk '{print $2}')`
2. 拉取新版本 `npm i -g tkserver@latest`
3. 启动新版本 `nohup tkserver >> tkserver.log 2>&1 &`

### 针对私有部署 (Docker) 的更新方式

1. 拉取新版本 `docker pull imaegoo/twikoo`
2. 停止旧版本容器 `docker stop twikoo`
3. 删除旧版本容器 `docker rm twikoo`
4. [启动新版本容器](#私有部署-Docker)

### 自动更新

考虑到可用性和安全性问题，Twikoo 没有实现自动更新，也没有计划实现自动更新。如果您希望实现自动更新，可以参考 MHuiG 基于 Github 工作流的 [twikoo-update](https://github.com/MHuiG/twikoo-update) 的实现方式。

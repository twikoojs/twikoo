# 快速上手

Twikoo 分为云函数和前端两部分，部署时请注意保存二者版本一致。

* [云函数部署](#云函数部署)有 4 种方式，[一键部署](#一键部署)、[手动部署](#手动部署)、[命令行部署](#命令行部署)和[Vercel 部署](#vercel-部署)。
* [前端部署](#前端部署)有 2 种方式，如果您的网站主题支持 Twikoo，您只需在配置文件中指定 Twikoo 即可；如果您的网站主题不支持 Twikoo，您需要修改源码手动引入 Twikoo 的 js 文件并初始化之。

## 云函数部署

| <div style="width: 6em">部署方式</div> | 描述 |
| ---- | ---- |
| [一键部署](#一键部署) | [ 不再建议 ] 虽然方便，但是仅支持按量计费环境——也就是说，**一键部署的环境，当免费资源用尽后，将会产生费用**。且按量计费环境无法切换为包年包月环境。免费额度数据库读操作数只有 500 次 / 天，**无法支撑 Twikoo 的运行需求**。 |
| [手动部署](#手动部署) | [ 不再建议 ] 适用于已有免费基础班 1 环境，或计划付费购买腾讯云云开发包年包月环境的的用户。 |
| [命令行部署](#命令行部署) | [ 不再建议 ] 仅针对有 Node.js 经验的开发者。 |
| [Vercel 部署](#vercel-部署) | [ 建议 ] 适用于错过云开发免费活动，想要免费部署的用户。 |

### 一键部署

1. 点击以下按钮将 Twikoo 一键部署到云开发<br>
[![部署到云开发](https://main.qcloudimg.com/raw/67f5a389f1ac6f3b4d04c7256438e44f.svg)](https://console.cloud.tencent.com/tcb/env/index?action=CreateAndDeployCloudBaseProject&appUrl=https%3A%2F%2Fgithub.com%2Fimaegoo%2Ftwikoo&branch=dev)
2. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
3. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”

### 手动部署

如果您打算部署到一个现有的云开发环境，请直接从第 3 步开始。

1. 进入[云开发CloudBase](https://curl.qcloud.com/KnnJtUom)活动页面，滚动到“新用户专享”部分，选择适合的套餐，点击“立即购买”，按提示创建好环境。
::: tip 提示
* 推荐创建上海环境。如选择广州环境，需要在 `twikoo.init()` 时额外指定环境 `region: "ap-guangzhou"`
* 环境名称自由填写
* 推荐选择计费方式`包年包月`，套餐版本`基础班 1`，超出免费额度不会收费
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
{ "dependencies": { "twikoo-func": "1.4.3" } }
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
[![](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/imaegoo/twikoo/tree/dev/src/vercel-min)
6. 添加环境变量 `MONGODB_URI` 到 Vercel，值为第 3 步的数据库连接字符串
7. Vercel 环境地址（包含 `https://` 前缀）即为您的环境 id

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
npm install hexo-next-twikoo@1.0.1
```

然后在配置中添加

``` yml
twikoo:
  enable: true
  visitor: true
  envId: xxxxxxxxxxxxxxx # 腾讯云环境id
  # region: ap-guangzhou # 环境地域，默认为 ap-shanghai
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

### 通过 CDN 引入

::: tip 提示
如果您使用的博客主题不支持 Twikoo，并且您不知道如何引入 Twikoo，您可以[在 Github 提交适配请求](https://github.com/imaegoo/twikoo/issues/new)
:::

``` html
<div id="tcomment"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@1.4.3/dist/twikoo.all.min.js"></script>
<script>
twikoo.init({
  envId: '您的环境id',
  el: '#tcomment',
  // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，如果您的环境地域不是上海，需传此参数
  // path: 'window.location.pathname', // 用于区分不同文章的自定义 js 路径，如果您的文章路径不是 location.pathname，需传此参数
  // lang: 'zh-CN', // 用于手动设定评论区语言，支持的语言列表 https://github.com/imaegoo/twikoo/blob/dev/src/js/utils/i18n/index.js
})
</script>
```

> 建议使用 CDN 引入 Twikoo 的用户在链接地址上锁定版本，以免将来 Twikoo 升级时受到非兼容性更新的影响。

## 开启管理面板

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

## 版本更新

不同部署方式的更新方式也不同，请对号入座。更新部署成功后，请不要忘记同时更新前端的 Twikoo CDN 地址 `https://cdn.jsdelivr.net/npm/twikoo@x.x.x/dist/twikoo.all.min.js` 中的 `x.x.x`，使之与云函数版本号相同，然后部署网站。

### 针对一键部署的更新方式

登录[环境-我的应用](https://console.cloud.tencent.com/tcb/apps/index)，输入

* 来源地址：`https://github.com/imaegoo/twikoo/tree/dev`
* 部署分支：`dev`

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

### 自动更新

考虑到可用性和安全性问题，Twikoo 没有实现自动更新，也没有计划实现自动更新。如果您希望实现自动更新，可以参考 MHuiG 基于 Github 工作流的 [twikoo-update](https://github.com/MHuiG/twikoo-update) 的实现方式。

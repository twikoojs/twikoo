# 快速上手

## 一键部署

1. 点击以下按钮将 Twikoo 一键部署到云开发<br>
[![部署到云开发](https://main.qcloudimg.com/raw/67f5a389f1ac6f3b4d04c7256438e44f.svg)](https://console.cloud.tencent.com/tcb/env/index?action=CreateAndDeployCloudBaseProject&appUrl=https%3A%2F%2Fgithub.com%2Fimaegoo%2Ftwikoo&branch=dev)
2. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
3. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”

::: warning 注意
一键部署虽然方便，但是仅支持按量计费环境——也就是说，**一键部署的环境，当免费资源用尽后，将会产生费用**。且按量计费环境无法切换为包年包月环境。

大多数情况下，免费资源能够满足日访问量在 10,000 以下的站点（参考：[免费资源如何计算？](faq.html#免费资源如何计算)）。

如果您希望，当免费资源用尽时，不产生费用，请参考下面的教程手动部署。
:::

## 环境初始化

[查看环境初始化与环境部署视频教程](https://www.bilibili.com/video/BV1MZ4y1G7VB)

Twikoo 使用云开发作为评论后台，每个云开发用户均长期享受1个免费的标准型基础版1资源套餐。如果您已经拥有了一个免费版云开发环境，Twikoo 也可以与其他项目共用一个环境，请直接查看[环境部署](#环境部署)。

1. [注册云开发CloudBase](https://curl.qcloud.com/KnnJtUom)
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)，新建环境，请按需配置环境<br>
::: tip 提示
* 推荐创建上海环境。如选择广州环境，需要在 `twikoo.init()` 时额外指定环境 `region: "ap-guangzhou"`
* 环境名称自由填写
* 推荐选择计费方式`包年包月`，套餐版本`基础班 1`，超出免费额度不会收费
* 如果提示选择“应用模板”，请选择“空模板”
:::
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”
5. 复制环境Id备用

## 环境部署

### ① 网页方式（推荐）

1. 进入[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击“新建云函数”
2. 函数名称请填写：`twikoo`，创建方式请选择：`空白函数`，运行环境请选择：`Nodejs 10.15`，函数内存请选择：`128MB`，点击“下一步”
3. 打开 [index.js](https://imaegoo.coding.net/public/twikoo/twikoo/git/files/dev/src/function/twikoo/index.js)，全选代码、复制、粘贴到“函数代码”输入框中，点击“确定”
4. 创建完成后，点击“twikoo"进入云函数详情页，进入“函数代码”标签，点击“文件 - 新建文件”，输入 `package.json`，回车
5. 打开 [package.json](https://imaegoo.coding.net/public/twikoo/twikoo/git/files/dev/src/function/twikoo/package.json)，全选代码、复制、粘贴到代码框中，点击“保存并安装依赖”

::: tip 提示
[如何更新 Twikoo 版本？](faq.html#如何更新-twikoo-版本)
:::

### ② 脚本方式

::: warning 注意
* 请确保您已经安装了 [Node.js](https://nodejs.org/en/download/)
* 请将命令、代码中“您的环境id”替换为您自己的环境id
* 第4步会弹出浏览器要求授权，需在有图形界面的系统下进行
* 请勿在 Termux 下操作。虽然可以部署成功，但是使用时会报错 `[FUNCTIONS_EXECUTE_FAIL] Error: EACCES: permission denied, open '/var/user/index.js'`，这是 cloudbase-cli 的问题
:::

1. 克隆本仓库
``` sh
git clone https://github.com/imaegoo/twikoo.git # 或 git clone https://e.coding.net/imaegoo/twikoo/twikoo.git
cd twikoo
```
> 如果您没有安装 Git，也可以从 [Release](https://github.com/imaegoo/twikoo/releases) 页面下载最新的 Source code<br>
> 如果您所在的地区访问 Github 速度慢，也可以尝试另一个仓库地址：[https://imaegoo.coding.net/public/twikoo/twikoo/git](https://imaegoo.coding.net/public/twikoo/twikoo/git)
2. 安装依赖项
``` sh
npm install # 或 yarn install
```
3. 授权云开发环境（此命令会弹出浏览器要求授权，需在有图形界面的系统下进行）
``` sh
npm run login # 或 yarn run login
```
4. 自动部署
``` sh
npm run deploy -- -e 您的环境id # 或 yarn deploy -e 您的环境id
```

::: tip 提示
脚本部署用户更新 Twikoo 版本时，请执行
``` sh
git pull
npm install # 或 yarn install
npm run deploy -- -e 您的环境id # 或 yarn deploy -e 您的环境id
```
更新现有的云函数，并同时更新网站 Twikoo CDN 地址中的版本号，使之保持一致
:::

## 配置使用

### 在 Hexo Butterfly 主题使用

Butterfly 目前支持 Twikoo，请查看 [Butterfly 安裝文檔(四) 主題配置-2](https://butterfly.js.org/posts/ceeb73f/#%E8%A9%95%E8%AB%96)

### 在 Hexo Volantis 主题使用

Volantis 目前支持 Twikoo，请查看 [hexo-theme-volantis/_config.yml](https://github.com/volantis-x/hexo-theme-volantis/blob/master/_config.yml)

``` yml
comments:
  twikoo:
    js: https://cdn.jsdelivr.net/npm/twikoo@0.5.1/dist/twikoo.all.min.js
    envId: xxxxxxxxxxxxxxx # 腾讯云环境id
```

### 在 Hexo Ayer 主题使用

Ayer 目前支持 Twikoo，请查看 [hexo-theme-ayer/_config.yml](https://github.com/Shen-Yu/hexo-theme-ayer/blob/master/_config.yml)

``` yml
twikoo:
  envId: xxxxxxxxxxxxxxx # 腾讯云环境id
```

### 在 Hexo Icarus 主题使用

请参考 [基于腾讯云，给你的 Icarus 博客配上 Twikoo 评论系统](https://anzifan.com/post/icarus_to_candy_2/) by 异次元de机智君💯

### 通过 CDN 引入

::: tip 提示
如果您使用的博客主题不支持 Twikoo，并且您不知道如何引入 Twikoo，您可以[在 Github 提交适配请求](https://github.com/imaegoo/twikoo/issues/new)
:::

``` html
<div id="tcomment"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@0.5.1/dist/twikoo.all.min.js"></script>
<script>
twikoo.init({
  envId: '您的环境id',
  el: '#tcomment',
  // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，如果您的环境地域不是上海，需传此参数
  // path: 'window.location.pathname', // 用于区分不同文章的自定义 js 路径，如果您的文章路径不是 location.pathname，需传此参数
})
</script>
```

> 建议使用 CDN 引入 Twikoo 的用户在链接地址上锁定版本，以免将来 Twikoo 升级时受到非兼容性更新的影响。

### 通过 NPM 引入

::: tip 提示
如果您使用的博客主题不支持 Twikoo，并且您不知道如何引入 Twikoo，您可以[在 Github 提交适配请求](https://github.com/imaegoo/twikoo/issues/new)
:::

``` sh
npm install twikoo # 或 yarn add twikoo
```

``` html
<div id="tcomment"></div>
```

``` js
import twikoo from 'twikoo' // 或 const twikoo = require('twikoo')
twikoo.init({
  envId: '您的环境id',
  el: '#tcomment',
  // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，如果您的环境地域不是上海，需传此参数
  // path: 'window.location.pathname', // 用于区分不同文章的自定义 js 路径，如果您的文章路径不是 location.pathname，需传此参数
})
```

## 开启管理面板

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

# 快速上手

[查看视频](https://www.bilibili.com/video/BV1MZ4y1G7VB?zw)

## 环境初始化

Twikoo 使用云开发作为评论后台，每个云开发用户均长期享受1个免费的标准型基础版1资源套餐。如果您已经拥有了一个免费版云开发环境，在环境配置符合要求的情况下，Twikoo 理论可以与其他项目共用一个环境。

1. [注册云开发CloudBase](https://curl.qcloud.com/KnnJtUom)
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)，新建环境，请按需配置环境<br>
::: tip 提示
* 环境名称自由填写
* 推荐选择计费方式`包年包月`，套餐版本`基础班 1`，超出免费额度不会收费
* 如果提示选择“应用模板”，请选择“空模板”
:::
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”
5. 复制环境Id备用

## 环境部署

### ① 简单方式（推荐）

1. 进入[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击“新建云函数”
2. 函数名称请填写：`twikoo`，其余默认，点击“下一步”
3. 打开 [index.js](https://imaegoo.coding.net/public/twikoo/twikoo/git/files/dev/src/function/twikoo/index.js)，全选代码、复制、粘贴到“函数代码”输入框中，点击“确定”
4. 创建完成后，点击“twikoo"进入云函数详情页，进入“函数代码”标签，点击“文件 - 新建文件”，输入 `package.json`，回车
5. 打开 [package.json](https://imaegoo.coding.net/public/twikoo/twikoo/git/files/dev/src/function/twikoo/package.json)，全选代码、复制、粘贴到代码框中，点击“保存并安装依赖”

::: tip 提示
更新 Twikoo 版本时，直接前往云函数详情页，将新的云函数代码（[index.js](https://imaegoo.coding.net/public/twikoo/twikoo/git/files/dev/src/function/twikoo/index.js) 和 [package.json](https://imaegoo.coding.net/public/twikoo/twikoo/git/files/dev/src/function/twikoo/package.json) 两个文件）粘贴、保存并安装依赖即可。
:::

### ② 脚本方式（不推荐）

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
> 如果您所在的地区访问 Github 速度慢，您可以尝试另一个仓库地址：[https://imaegoo.coding.net/public/twikoo/twikoo/git](https://imaegoo.coding.net/public/twikoo/twikoo/git)
2. 安装依赖项
``` sh
npm install # 或 yarn install
```
3. 设置环境id
``` sh
echo 您的环境id > envId.txt
```
4. 授权云开发环境（此命令会弹出浏览器要求授权，需在有图形界面的系统下进行）
``` sh
npm run login # 或 yarn run login
```
5. 自动部署
``` sh
npm run deploy # 或 yarn deploy
```

::: tip 提示
更新 Twikoo 版本时，请执行
``` sh
git pull
npm install
npm run deploy
```
更新现有的云函数
:::

## 配置使用

### 在 Hexo Butterfly 主题使用

Butterfly 目前支持 Twikoo，请查看 [Butterfly 安裝文檔(四) 主題配置-2](https://butterfly.js.org/posts/ceeb73f/#%E8%A9%95%E8%AB%96)

### 在 Hexo Icarus 主题使用

[魔改版 Icarus](https://github.com/imaegoo/hexo-theme-icarus)目前支持 Twikoo，官方版 Icarus 暂不支持，适配工作将会在近期完成

### 通过 CDN 引入

::: tip 提示
如果您使用的博客主题不支持 Twikoo，并且您不知道如何引入 Twikoo，您可以[在 Github 提交适配请求](https://github.com/imaegoo/twikoo/issues/new)
:::

``` html
<div id="tcomment"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@0.2.7/dist/twikoo.all.min.js"></script>
<script>twikoo.init({ envId: '您的环境id', el: '#tcomment' })</script>
```

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
twikoo.init({ envId: '您的环境id', el: '#tcomment' })
```

## 开启管理面板

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

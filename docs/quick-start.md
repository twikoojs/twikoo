# 快速上手

## 环境初始化

Twikoo 使用云开发作为评论后台，每个云开发用户均长期享受1个免费的标准型基础版1资源套餐。如果您已经拥有了一个免费版云开发环境，在环境配置符合要求的情况下，Twikoo 理论可以与其他项目共用一个环境。

1. [注册云开发CloudBase](https://curl.qcloud.com/KnnJtUom)
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)，新建环境，请按个人需要配置环境<br>
::: tip 提示
* 推荐选择计费方式`包年包月`，套餐版本`基础班 1`
* 如果提示“选择部署应用”，请选择“不创建环境”
:::
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”
5. 复制环境Id备用

## 环境部署

::: warning 注意
* 请确保您已经安装了 [Node.js](https://nodejs.org/en/download/)
* 请将命令、代码中“您的环境id”替换为您自己的环境id
* 请不要使用 Windows 自带的记事本编辑 envId.txt，否则会部署失败，后续会修复该问题
:::

1. 克隆本仓库
``` sh
git clone https://github.com/imaegoo/twikoo.git
cd twikoo
```
> 如果您没有安装 Git，也可以从 [Release](https://github.com/imaegoo/twikoo/releases) 页面下载最新的 Source code
2. 安装依赖项
``` sh
npm install # 或 yarn install
```
3. 设置环境id
``` sh
echo 您的环境id > envId.txt
```
4. 授权云开发环境
``` sh
npm run login # 或 yarn run login
```
5. 自动部署
``` sh
npm run deploy # 或 yarn deploy
```
> 更新 Twikoo 版本时，请再次执行此命令更新现有的云函数

## 使用

### 通过 CDN 引入

``` html
<div id="twikoo"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@0.1.15/dist/twikoo.all.min.js"></script>
<script>twikoo.init({ envId: '您的环境id' })</script>
```

### 通过 NPM 引入

``` sh
npm install twikoo # 或 yarn add twikoo
```

``` html
<div id="twikoo"></div>
```

``` js
import twikoo from 'twikoo' // 或 const twikoo = require('twikoo')
twikoo.init({ envId: '您的环境id' })
```

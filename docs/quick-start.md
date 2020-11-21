# 快速上手

## 环境初始化

Twikoo 使用云开发作为评论后台，每个云开发用户均长期享受1个免费的标准型基础版1资源套餐。如果您已经拥有了一个免费版云开发环境，在环境配置符合要求的情况下，Twikoo 理论可以与其他项目共用一个环境。

1. [注册云开发CloudBase](https://curl.qcloud.com/KnnJtUom)
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)，新建环境，请按个人需要配置环境<br>
::: tip 提示
* 推荐选择计费方式`包年包月`，套餐版本`基础班 1`
* 如果提示“选择部署应用”，请选择“不创建环境”
* 如果提示选择“应用模板”，请选择“空模板”
:::
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站域名添加到“WEB安全域名”
5. 复制环境Id备用

## 环境部署（简单方式，推荐）

1. 进入[环境-云函数](https://console.cloud.tencent.com/tcb/scf/index)，点击“新建云函数”
2. 函数名称请填写：`twikoo`，其余默认，点击“下一步”
3. 将[index.js](https://imaegoo.coding.net/p/twikoo/d/twikoo/git/raw/dev/src/function/twikoo/index.js)全选、复制、粘贴到“函数代码”输入框中，点击“确定”
4. 创建完成后，点击“twikoo"进入云函数详情页，进入“函数代码”标签，点击“文件 - 新建文件”，输入 `package.json`，回车
5. 将[package.json](https://imaegoo.coding.net/p/twikoo/d/twikoo/git/raw/dev/src/function/twikoo/package.json)全选、复制、粘贴到代码框中，点击“保存并安装依赖”

> 更新 Twikoo 版本时，直接前往云函数详情页，将新的代码粘贴保存即可。

## 环境部署（脚本方式）

::: warning 注意
* 请确保您已经安装了 [Node.js](https://nodejs.org/en/download/)
* 请将命令、代码中“您的环境id”替换为您自己的环境id
:::

1. 克隆本仓库
``` sh
git clone https://github.com/imaegoo/twikoo.git # 或 git clone https://e.coding.net/imaegoo/twikoo/twikoo.git
cd twikoo
```
> 如果您没有安装 Git，也可以从 [Release](https://github.com/imaegoo/twikoo/releases) 页面下载最新的 Source code
> 如果您所在的地区访问 Github 速度慢，您可以尝试另一个仓库地址：https://imaegoo.coding.net/public/twikoo/twikoo/git
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

> 更新 Twikoo 版本时，请执行 `git pull` 和 `npm run deploy` 更新现有的云函数

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

## 开启管理面板

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

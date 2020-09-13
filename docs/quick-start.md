# 快速上手

## 环境初始化

Twikoo 使用云开发作为评论后台，每个云开发用户均长期享受1个免费的标准型基础版1资源套餐。

1. [注册云开发CloudBase](https://curl.qcloud.com/KnnJtUom)
2. 进入[云开发控制台](https://console.cloud.tencent.com/tcb/)，新建环境，请按个人需要配置环境，推荐选择计费方式`包年包月`，套餐版本`基础班 1`
3. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，启用“匿名登录”
4. 进入[环境-安全配置](https://console.cloud.tencent.com/tcb/env/safety)，将网站地址添加到“WEB安全域名”
5. 复制环境Id备用

## 环境部署

::: warning 注意
请将命令、代码中“您的环境id”替换为您自己的环境id
:::

请确保您已经安装了 [Node.js](https://nodejs.org/en/download/)。

1. [下载](https://github.com/imaegoo/twikoo/archive/dev.zip)或克隆本仓库
``` sh
git clone https://github.com/imaegoo/twikoo.git
```
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
npm run login # 或 yarn login
```
5. 自动部署
``` sh
npm run deploy # 或 yarn deploy
```

## 在页面中使用

``` html
...
<div id="twikoo"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo/dist/twikoo.all.min.js"></script>
<script>twikoo.init({ envId: '您的环境id' })</script>
...
```

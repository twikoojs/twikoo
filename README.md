# Twikoo

一个轻量级微型博客系统，基于腾讯云开发。<br>
A simple micro blog system based on Tencent CloudBase (tcb).

![Demo](./public/demo.png)

## 特色 | Features

* 发推 | Send twii
* 评论 | Comment
* 点赞 | Like
* 纯静态 | Static pages
* 可嵌入 | Embedded
* 免费搭建 | Free deploy

## 快速开始 | Quick Start

1. 注册 https://console.cloud.tencent.com/tcb/
2. 初始化数据库
```
npm install
npx tcb login
npx tcb functions:deploy migrate
npx tcb functions:invoke migrate
```

## 贡献者 | Contributors

## 捐赠 | Donate

## 开发 | Development

```
npm install
npm run serve
npm run build
npm run lint
```

## 许可 | License

[MIT License](./LICENSE)

<a href="https://twikoo.js.org/"><img src="./docs/static/logo.png" width="300" alt="Twikoo"></a>

---

[![](https://img.shields.io/npm/v/twikoo)](https://www.npmjs.com/package/twikoo)
[![](https://img.shields.io/bundlephobia/minzip/twikoo)](https://bundlephobia.com/result?p=twikoo)
[![](https://img.shields.io/npm/dt/twikoo)](https://www.npmjs.com/package/twikoo)
[![](https://data.jsdelivr.com/v1/package/npm/twikoo/badge)](https://www.jsdelivr.com/package/npm/twikoo)
[![](https://app.cloudback.it/badge/twikoojs/twikoo)](https://cloudback.it)
[![](https://img.shields.io/npm/l/twikoo)](./LICENSE)

一个**简洁**、**安全**、**免费**的静态网站评论系统。<br>
A **simple**, **safe**, **free** comment system.  
[English](./README.en.md) | **简体中文**

## 特色 | Features

### 简单

- 免费搭建（支持腾讯云 CloudBase、Vercel、Netlify、Hugging Face、Railway、Zeabur、Cloudflare Workers、AWS Lambda、EdgeOne Makers 等平台，也可使用私有服务器作为评论后台）
- 简单部署（支持 Vercel 一键部署，各平台均有图文部署教程，另有 Docker 私有部署）

### 易用

- 支持回复、点赞、点踩
- 无需额外适配，支持搭配浅色主题与深色主题使用
- 支持 API 调用，批量获取文章评论数、最新评论
- 访客在昵称栏输入 QQ 号，会自动补全 QQ 昵称和 QQ 邮箱
- 访客填写数字 QQ 邮箱，会使用 QQ 头像作为评论头像
- 支持评论框粘贴图片（可禁用）
- 支持插入图片（可禁用）
- 支持云开发图床、去不图床、S.EE、兰空图床、PicList、EasyImage、Chevereto，以及 S3 兼容存储（Cloudflare R2 / MinIO 等）
- 支持插入表情（可禁用）
- 支持 Ctrl + Enter 快捷回复
- 评论框内容实时保存草稿，刷新不会丢失
- [支持 Katex 公式](https://twikoo.js.org/faq.html#%E5%A6%82%E4%BD%95%E5%90%AF%E7%94%A8-katex-%E6%94%AF%E6%8C%81)
- 支持按语言的代码高亮

### 安全

- 隐私信息安全（通过云函数控制敏感字段（邮箱、IP、环境配置等）不会泄露）
- 支持 Akismet 垃圾评论检测（需自行注册 [akismet.com](https://akismet.com/)）
- 支持腾讯云内容安全垃圾评论检测（需自行注册 [腾讯云内容安全](https://console.cloud.tencent.com/cms/text/overview)）
- 支持人工审核模式
- 防 XSS 注入
- 支持限制每个 IP 每 10 分钟最多发表多少条评论

### 即时

- 支持邮件提醒（访客和博主）
- 支持微信提醒（仅针对博主，基于 [Server 酱](https://sct.ftqq.com/r/13235)，需自行注册）
- 支持 QQ 提醒（仅针对博主，基于 [Qmsg 酱](https://qmsg.zendee.cn/)，需自行注册）
- 支持 QQ 提醒（仅针对博主，基于 [go-cqhttp](https://docs.go-cqhttp.org/)，需自行搭建并配置机器人及 QQ 账号）
- 支持钉钉、企业微信、飞书、Telegram、Discord、Bark、PushDeer、WxPusher 等渠道（仅针对博主，基于 [pushoo](https://twikoo.js.org/pushoo.html)，需自行注册）

### 个性

- 支持自定义评论框背景图片
- 支持自定义“博主”标识文字
- 支持自定义通知邮件模板
- 支持自定义评论框提示信息（placeholder）
- 支持自定义表情列表（兼容 [OwO 的数据格式](https://cdn.jsdelivr.net/npm/owo@1.0.2/demo/OwO.json)）
- 支持自定义【昵称】【邮箱】【网址】必填 / 选填
- 支持自定义代码高亮主题

### 便捷管理

- 内嵌式管理面板，通过密码登录，可方便地查看评论、隐藏评论、删除评论、修改配置
- 支持隐藏管理入口，通过输入暗号显示
- 支持从 Valine、Artalk、Disqus 导入评论

## 预览 | Preview

<details>
<summary>点击展开</summary>

### 评论

![评论](./docs/static/readme-1.png)

### 评论管理

![评论管理](./docs/static/readme-2.png)

### 推送通知

![推送通知](./docs/static/readme-3.jpg)

</details>

## 快速上手 | Quick Start

有关详细教程，请查看[快速上手](https://twikoo.js.org/quick-start.html)

<details>
<summary>如果你想获取更新动态、建言献策、参与测试，欢迎加入讨论群：1080829142</summary>
<img height="300" alt="1080829142" src="https://www.imaegoo.com/gallery/2020/hello-twikoo.png" />
</details>

<!-- ## 贡献者 | Contributors -->

## 特别感谢 | Special Thanks

图标设计：[Maemo Lee](https://www.maemo.cc)

<!-- ## 捐赠 | Donate -->

## 开发 | Development

本仓库是 pnpm monorepo（Node 26）。本地二次开发命令：

```sh
pnpm install # 安装依赖
pnpm demo # 一键启动本地演示：客户端 watch + tkserver + demo 页 (http://localhost:9820/demo.html)
pnpm lint # 代码检查
pnpm typecheck # 类型检查
pnpm test # 单元测试
pnpm build # 编译 (packages/client/dist/twikoo.all.min.js)
```

如果您的改动能够帮助到更多人，欢迎提交 Pull Request！

## 国际化 | I18N

支持 9 种语言（简体中文、繁体中文、English、日本語、한국어、Tiếng Việt、Bahasa Indonesia、Oʻzbekcha、Узбекча）。欢迎[提交翻译 PR](https://github.com/twikoojs/twikoo/tree/main/packages/client/src/i18n/locales)。

## 许可 | License

<details>
<summary>MIT License</summary>

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo?ref=badge_large)

</details>

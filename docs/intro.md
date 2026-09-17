<img src="./static/logo.png" width="300" alt="Twikoo">

---

<style>
  .shields {
    display: inline-block;
  }
</style>

<a href="https://www.npmjs.com/package/twikoo">
  <img class="shields" src="https://img.shields.io/npm/v/twikoo" />
</a>
<span>&nbsp;</span>
<a href="https://bundlephobia.com/result?p=twikoo">
  <img class="shields" src="https://img.shields.io/bundlephobia/minzip/twikoo" />
</a>
<span>&nbsp;</span>
<a href="https://www.npmjs.com/package/twikoo">
  <img class="shields" src="https://img.shields.io/npm/dt/twikoo" />
</a>
<span>&nbsp;</span>
<a href="https://www.jsdelivr.com/package/npm/twikoo">
  <img class="shields" src="https://data.jsdelivr.com/v1/package/npm/twikoo/badge" />
</a>
<span>&nbsp;</span>
<a href="https://cloudback.it">
  <img class="shields" src="https://app.cloudback.it/badge/twikoojs/twikoo" />
</a>
<span>&nbsp;</span>
<a href="https://github.com/twikoojs/twikoo/blob/main/LICENSE">
  <img class="shields" src="https://img.shields.io/npm/l/twikoo" />
</a>

一个简洁、安全、免费的静态网站评论系统。<br>
A simple, safe, free comment system.

**简体中文** | [English](/en/intro)

## 特色

### 简单

- 免费搭建（使用云开发 / Vercel / 私有服务器作为评论后台）
- 简单部署（支持云开发 / Vercel 一键部署）

### 易用

- 支持回复、点赞
- 无需额外适配，支持搭配浅色主题与深色主题使用
- 支持 API 调用，批量获取文章评论数、最新评论
- 访客在昵称栏输入 QQ 号，会自动补全 QQ 昵称和 QQ 邮箱
- 访客填写数字 QQ 邮箱，会使用 QQ 头像作为评论头像
- 支持评论框粘贴图片（可禁用）
- 支持插入图片（可禁用）
- 支持去不图床、云开发图床
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
- 支持微信提醒（仅针对博主，基于 [Server酱](https://sc.ftqq.com/3.version)，需自行注册）
- 支持 QQ 提醒（仅针对博主，基于 [Qmsg酱](https://qmsg.zendee.cn/)，需自行注册）
- 支持 QQ 提醒（针对博主QQ或者群，基于 [go-cqhttp](https://docs.go-cqhttp.org/)，需自己有服务器）

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

### 缺点

- 不支持 IE

## 预览

### 评论

![评论](./static/readme-1.png)

### 评论管理

![评论管理](./static/readme-2.png)

### 推送通知

![推送通知](./static/readme-3.jpg)

## 交流群

如果你想获取更新动态、建言献策、参与测试，欢迎加入讨论群：<br>
<img height="300" alt="1080829142" src="https://www.imaegoo.com/gallery/2020/hello-twikoo.png" />

## 浏览器支持

::: tip 提示
2.0 起放弃 IE / ES5 兼容（构建目标为 **ES2022**），请使用下表所列版本及以上的现代浏览器。
:::

| IE / Edge | Firefox | Chrome | Safari | iOS Safari |
| --------- | ------- | ------ | ------ | ---------- |
| Edge 94+  | 93+     | 94+    | 15.4+  | 15.4+      |

> 不再支持 IE 与 ES5 引擎；最低版本按 ES2022 语法特性确定（BC-2）。

## 更新日志 & 开发计划

[更新日志](https://github.com/twikoojs/twikoo/releases) & [开发计划](https://github.com/twikoojs/twikoo/projects/2)

<!-- ## 贡献者 | Contributors -->

## 特别感谢

图标设计：[Maemo Lee](https://www.maemo.cc)

<!-- ## 捐赠 | Donate -->

## 开发

本仓库是 pnpm monorepo，要求 **Node 24**（`.nvmrc` = 24，产物语法目标 ES2022）。本地二次开发命令：

```sh
pnpm install # 安装依赖
pnpm demo # 一键启动本地演示（客户端 watch + tkserver + demo 页，完全离线可用）
pnpm lint # 代码检查
pnpm typecheck # 类型检查
pnpm test # 单元测试
pnpm build # 编译 (packages/client/dist/twikoo.all.min.js)
```

### 本地开发（`pnpm demo`）

`pnpm demo` 一条命令拉起三个进程：客户端 Vite watch（端口 9820）、tkserver 后端（端口 8080）、demo 页（端口 9820，打开 `http://localhost:9820/demo.html`）。

- 依赖全部本地化（bulma / katex 来自 npm 依赖，不经 CDN），**断网可用**；
- 首次启动会自动生成测试数据（11 个场景：普通评论、多层回复、owo 表情、公式、代码块、链接与图片、已点赞、垃圾评论、多路径分页、访客计数、全量配置），数据落在仓库根 `data/` 目录，**删除该目录即可重置**；
- 测试数据只在设置 `TWIKOO_SEED=1`（`pnpm demo` 已自动设置）时生成，生产部署不会触达。

如果您的改动能够帮助到更多人，欢迎提交 Pull Request！

## 国际化

支持 9 种语言（简体中文、繁体中文、English、日本語、한국어、Tiếng Việt、Bahasa Indonesia、Oʻzbekcha、Узбекча）。欢迎[提交翻译 PR](https://github.com/twikoojs/twikoo/tree/main/packages/client/src/i18n/locales)。

## 许可

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo?ref=badge_large)

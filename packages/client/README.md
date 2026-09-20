# twikoo

💬 一个简洁、安全、免费的静态网站评论系统 —— **前端库**（UMD 产物）。服务端需另行部署。

- 官网与文档：<https://twikoo.js.org>
- 部署指引（选一个平台，按步骤做）：<https://twikoo.js.org/backend.html>
- 更新日志：<https://github.com/twikoojs/twikoo/blob/main/CHANGELOG.md>

## 用法

在需要显示评论的位置放一个容器，然后初始化：

```html
<div id="twikoo"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@latest/dist/twikoo.min.js"></script>
<script>
  twikoo.init({
    envId: "https://your-twikoo.vercel.app", // 服务端地址（腾讯云环境填 envId）
    el: "#twikoo",
  });
</script>
```

也可以用 npm：`npm i twikoo`。

## 产物

| 文件                     | 说明                                               |
| ------------------------ | -------------------------------------------------- |
| `dist/twikoo.min.js`     | 推荐。不含腾讯云 SDK                               |
| `dist/twikoo.all.min.js` | 含腾讯云 SDK，腾讯云云开发环境用                   |
| `dist/*.nocss.js`        | 不带样式的版本，样式自备（另附 `dist/twikoo.css`） |
| `dist/locales/*.js`      | 非英语语言分片，按需自动加载                       |

> 浏览器基线 ES2022（Chrome/Edge 94+、Firefox 93+、Safari 15.4+）。想锁版本就把 CDN 地址里的
> `latest` 换成具体版本号。

# Twikoo EdgeOne Makers 版本

## 部署

请查看 [Twikoo EdgeOne Makers 部署](https://github.com/Mintimate/twikoo-eo)

## 特性

- 基于 EdgeOne Makers 边缘计算，全球加速
- 使用 Blob 存储，无需额外数据库
- 支持邮件通知、即时消息推送
- 一键部署，开箱即用

## 自定义 SMTP

EdgeOne Makers 的 Node Function 运行时不支持 TCP socket，无法直接通过 SMTP 协议连接邮件服务器。自定义 SMTP 由 `cloud-functions/smtp.go` 这个 Go Cloud Function 负责连接邮件服务器，Node Function 只通过 HTTP 调用同项目的 `/smtp` Bridge。

使用自定义 SMTP 时：

1. 在 EdgeOne Makers 环境变量中配置 `TWIKOO_SMTP_BRIDGE_TOKEN`，建议使用随机长字符串。该变量用于保护 `/smtp` Bridge，不是 SMTP 密码。可使用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成。
2. 在 Twikoo 管理面板中配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASS`、`SENDER_EMAIL`。
3. 使用 465 端口通常配置 `SMTP_SECURE=true`；使用 587 端口通常配置 `SMTP_SECURE=false`。
4. 不要同时配置 `SMTP_SERVICE`。`SMTP_SERVICE=SendGrid` 或 `SMTP_SERVICE=MailChannels` 会继续走对应的 HTTP API，不经过 Go SMTP Bridge。

## ⚠️ 破坏性更新说明

**EdgeOne 服务端目录已从 `src/server/eo-pages` 更名为 `src/server/eo-makers`；早期 KV 存储已迁移至 Blob，KV 数据不会自动迁移。**

如果你是从旧版 EdgeOne Pages 升级，请改用 `src/server/eo-makers` 部署；如果旧版本仍使用 KV 存储，请在部署前完成数据导出和导入，否则历史评论数据将丢失：

1. **更新部署目录**：使用 `src/server/eo-makers` 部署 EdgeOne Makers 版本。
2. **导出数据**：在旧版本的 Twikoo 管理面板中，进入「数据管理」→「导出」，下载评论备份文件（JSON 格式）。
3. **部署新版本**：参考部署文档完成部署（无需再绑定 KV，Blob 存储会自动初始化）。
4. **导入数据**：在新版本的 Twikoo 管理面板中，进入「数据管理」→「导入」，上传之前备份的文件。

## License

<details>
<summary>MIT License</summary>

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo?ref=badge_large)

</details>

# Twikoo EdgeOne Pages 版本

## 部署

请查看 [Twikoo EdgeOne Pages 部署](https://github.com/Mintimate/twikoo-eo)

## 特性

- 基于 EdgeOne Pages 边缘计算，全球加速
- 使用 Blob 存储，无需额外数据库
- 支持邮件通知、即时消息推送
- 一键部署，开箱即用

## ⚠️ 破坏性更新说明

**存储后端已从早期的 KV 迁移至 Blob，数据不会自动迁移。**

如果你是从旧版本（使用 KV 存储）升级，请在部署前完成以下步骤，否则历史评论数据将丢失：

1. **导出数据**：在旧版本的 Twikoo 管理面板中，进入「数据管理」→「导出」，下载评论备份文件（JSON 格式）。
2. **部署新版本**：按下方快速上手步骤完成部署（无需再绑定 KV，Blob 存储会自动初始化）。
3. **导入数据**：在新版本的 Twikoo 管理面板中，进入「数据管理」→「导入」，上传之前备份的文件。

## License

<details>
<summary>MIT License</summary>

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo?ref=badge_large)

</details>

# twikoo-edgeone-makers

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（腾讯云 EdgeOne Pages Makers）

1. EdgeOne Pages → Makers 函数 → 绑定本目录
2. `npm run build`（生成 ip2region 内联数据；build.cjs 参照 1.x 重写）
3. Blob KV：平台自动提供 `@edgeone/pages-blob`（name: twikoo, strong 一致性）
4. SMTP：Go SMTP Bridge（smtp.go）或 SendGrid / MailChannels 通道

## 能力限制（§6.5 能力矩阵）

- mail：受限（仅上述三通道；`restricted` 声明）
- domPurify：false（适配器启动时注入直通实现，内容原样存储）
- akismet / tencentTms：false
- ip2region / imageUpload / qqAvatar：可用

## 平台核对清单（§6.8，查阅日期 2026-09-17）

- [x] Makers 云函数请求对象与 Blob KV API（EdgeOne Pages 官方文档）
- [x] 运行时版本（Node 20）与构建期可选版本差异
- [ ] EO Node 20 跑 ES2022 产物实测（B.3 人工项；R-10 残留）
- [ ] Go SMTP Bridge 协同构建实测（B.3 人工项）

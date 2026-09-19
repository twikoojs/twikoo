# twikoo-deta

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（Deta Space）

1. Spacefile 声明微服务（端口 8080）
2. 环境变量：`MONGODB_URI`（必填）
3. **必须经 Cloudflare CDN 部署**：Deta 自身无法获取评论者 IP，
   IP 头 `cf-connecting-ip` 由 Cloudflare 注入（deta.space/docs，查阅 2026-09-17）

## 平台核对清单

- [x] IP 头 `cf-connecting-ip`（Cloudflare 形态）
- [ ] Deta Space 部署与平台存活状态实测（人工项；平台变动频繁）

# twikoo-vercel

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（Vercel）

1. Vercel → New Project → 导入仓库（或 `vercel deploy`）
2. 环境变量：`MONGODB_URI`（必填，Atlas/自建 Mongo 连接串）
3. 部署完成后前端配置 API 地址为部署域名

## 平台核对清单（§6.8，查阅日期 2026-09-17）

- [x] Serverless Function `(req, res)` 签名与 body 自动解析（vercel.com/docs/functions）
- [x] Node runtime 版本与默认值（项目 settings 或 vercel.json 指定 20+）
- [ ] 函数超时与区域配置实测（B.3 人工项）
- [ ] 冷启动与 Mongo 连接复用实测（B.3 人工项）

## 环境

- `MONGODB_URI`：Mongo 连接串（必填）

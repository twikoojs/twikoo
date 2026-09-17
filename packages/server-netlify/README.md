# twikoo-netlify

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（Netlify）

1. Netlify → New site → 导入仓库（Functions 目录 `netlify/functions`）
2. 环境变量：`MONGODB_URI`（必填）
3. 前端配置 API 地址为 `https://<site>.netlify.app/.netlify/functions/twikoo`

## 平台核对清单（§6.8，查阅日期 2026-09-17）

- [x] Functions v1 形态（`exports.handler`，event/返回体字符串化）——docs.netlify.com/functions
- [x] IP 头 `x-nf-client-connection-ip`（适配器已按此头提取，回退 x-real-ip/x-forwarded-for）
- [ ] Functions v2 形态差异实测（B.3 人工项；2.0 按事件归一化设计，v2 需平台适配层）
- [ ] 构建期 Node 版本对函数运行时的影响实测（B.3 人工项）

## 注意

- 独立适配器：直接依赖 @twikoojs/common，**不依赖 twikoo-vercel**（用户决策）

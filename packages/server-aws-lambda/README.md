# twikoo-aws-lambda

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（AWS Lambda + API Gateway）

1. Lambda → 创建函数（Node 20+ 运行时）
2. 函数代码：`exports.handler`（本包默认导出同形态）
3. API Gateway 代理集成（REST v1 或 HTTP v2 均支持）
4. 环境变量：`MONGODB_URI`（必填）

## 平台核对清单（查阅日期 2026-09-17）

- [x] API Gateway v1/v2 payload 双形态（docs.aws.amazon.com/lambda）
- [x] `requestContext.identity.sourceIp`（v1）与 `requestContext.http.sourceIp`（v2）
- [x] 返回体 body 字符串化
- [ ] 真机冷启动与 Mongo 连接实测（人工项）

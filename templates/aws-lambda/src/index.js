/**
 * AWS Lambda 转发壳：实现全在 `@twikoojs/aws-lambda`。
 *
 * 与 Vercel / CloudBase 的模板同理——Lambda 侧只解压代码包、不跑本仓库的构建，
 * 所以入口必须是纯 JS；依赖写 `latest`，重发部署即取新版本。
 * `index.handler` 与 `terraform/main.tf` 的 `handler = "index.handler"` 对应。
 */
exports.handler = require("@twikoojs/aws-lambda").handler;

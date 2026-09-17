# twikoo-func

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（CloudBase 控制台，D-22）

1. CloudBase 控制台 → 云函数 → 创建函数（模板 Node.js Hello World，运行时 Node 24.11）
2. 在线编辑器粘贴：`exports.main = require("twikoo-func").main`
3. 在线装依赖：仅声明 `twikoo-func`（其余依赖随 npm 安装自动拉取）
4. 创建后状态「正常」即部署完成

## 平台核对清单（§6.8，查阅日期 2026-09-17）

- [x] 函数入口 `exports.main(event, context)` 结构与返回体格式（docs.cloudbase.net 云函数章节）
- [x] 控制台「在线编辑器 + 在线装依赖」流程（4.3.0.1）；CLI（tcb fn deploy）2.0 起不再支持（BC-14）
- [x] 运行时创建后不可改版本
- [ ] 环境变量注入方式实测（B.3 人工项）
- [ ] MONGODB_URI 外接 Mongo 实测（B.3 人工项）

## 注意

- `exports.main` 导出名不可改（CloudBase 以此挂载）
- 环境变量：`MONGODB_URI`（可选外接 Mongo）、`TWIKOO_*` 业务配置存于数据库配置

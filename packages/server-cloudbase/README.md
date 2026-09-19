# twikoo-func

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## ⚠️ 2.0 升级须知（同名不同义）

**包名没变，但包的内容变了。**

|                                             | 1.x                                       | 2.0                                        |
| ------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| 定位                                        | 公共逻辑 + CloudBase 入口（代码全在这里） | **仅 CloudBase 薄适配器**（< 150 行）      |
| 公共逻辑位置                                | `twikoo-func` 内部（`utils/`、`fn/` 等）  | **`@twikoojs/common`**                     |
| 旧导出（`require('twikoo-func').utils` 等） | 可用                                      | **不再导出**（过渡期由转发导出兜底，见下） |

**过渡期兼容**：2.0 仍在 `twikoo-func` 保留一层转发导出
（`export * from '@twikoojs/common'` + `console.warn`），因此
`require('twikoo-func').xxx` 形式的公共函数调用**暂时仍可用**，
控制台出现一条弃用告警。**该转发导出将在 2.2.0 移除**——
请把对公共逻辑的引用改为 `@twikoojs/common`。

**部署方式变更**：`tcb fn deploy` / `npm run deploy` / `login` / `logout`
脚本与 `@cloudbase/cli` 依赖已移除，**2.0 起只支持控制台部署**（下方流程）。
这不影响云函数功能，也不影响控制台流程。

## 部署（CloudBase 控制台）

1. CloudBase 控制台 → 云函数 → 创建函数（模板 Node.js Hello World，运行时 Node 24.11）
2. 在线编辑器粘贴：`exports.main = require("twikoo-func").main`
3. 在线装依赖：仅声明 `twikoo-func`（其余依赖随 npm 安装自动拉取）
4. 创建后状态「正常」即部署完成

## 平台核对清单（查阅日期 2026-09-17）

- [x] 函数入口 `exports.main(event, context)` 结构与返回体格式（docs.cloudbase.net 云函数章节）
- [x] 控制台「在线编辑器 + 在线装依赖」流程；CLI（tcb fn deploy）2.0 起不再支持
- [x] 运行时创建后不可改版本
- [ ] 环境变量注入方式实测（人工项）
- [ ] MONGODB_URI 外接 Mongo 实测（人工项）

## 注意

- `exports.main` 导出名不可改（CloudBase 以此挂载）
- 环境变量：`MONGODB_URI`（可选外接 Mongo）、`TWIKOO_*` 业务配置存于数据库配置

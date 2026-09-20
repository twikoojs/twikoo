# templates —— 一键部署模板

各平台「一键部署」**直接消费**的模板目录。它们**不是 pnpm workspace 包**（未列入
`pnpm-workspace.yaml`），不参与构建、测试与发布，也不会被 `pnpm install` 安装。

## 三条硬约束（改这里之前先读）

1. **纯 JS、无构建步骤**。平台侧只克隆目录（或仓库）→ `npm install` → 直接加载入口文件，
   **不会执行本仓库的构建**。一旦把入口改成 TS，一键部署立刻失效——这正是 1.x 迁移到 2.0 时
   `vercel-min` 丢掉一键部署能力的原因（当时它变成了必须在 monorepo 里 `tsdown` 构建的 TS 包）。
2. **依赖一律写 `latest`**。一键部署跟随 npm 的稳定通道，发新版不需要回来改版本号。
3. **自包含**。目录里不能出现 `workspace:*` / `file:` 这类指向 monorepo 的依赖——
   平台只拿到这一个目录（或只看仓库根，如 CloudBase 的 `cloudbaserc.json`）。

> 需要断点调试或改实现时改 `packages/*`，模板里**只做转发**，一行 `require` 足矣。

## 目录

| 模板                | 平台                             | 入口                          | 消费方式                                              | 实现所在包                    |
| ------------------- | -------------------------------- | ----------------------------- | ----------------------------------------------------- | ----------------------------- |
| `vercel-min/`       | Vercel                           | `api/index.js`                | 文档站 Deploy 按钮 → `tree/main/templates/vercel-min` | `packages/server-vercel`      |
| `cloudbase/twikoo/` | 腾讯云开发（CloudBase）          | `index.js`                    | 仓库根 `cloudbaserc.json` 的 `functionRoot`           | `packages/server-cloudbase`   |
| `aws-lambda/src/`   | AWS Lambda                       | `index.js`                    | `terraform/` 里的 `source_path = "../src"`            | `packages/server-aws-lambda`  |
| `hf-space/`         | Hugging Face Space（自定义域名） | `Dockerfile` + `src/start.sh` | 手动复制进 Space 仓库                                 | `packages/server-self-hosted` |

> 每个模板的目录形状跟着**平台约定**走，没有强行统一：Vercel 必须把函数放进 `api/`、
> CloudBase 按 `functionRoot/<函数名>/` 找代码、Lambda 需要一个能被 Terraform 整个打包的源码目录。
> 判据只有一条：**平台照文档里的路径能找到入口，且入口不需要构建**。

## 与 `packages/*` 的区别

|          | `packages/*`                  | `templates/*`                             |
| -------- | ----------------------------- | ----------------------------------------- |
| 语言     | TS（`src/**` 禁止 `.js`）     | 纯 JS                                     |
| 依赖     | `workspace:*` 互链 + 锁定版本 | 只有一条 `latest`                         |
| 由谁消费 | pnpm / 构建产物 / npm 发布    | 云平台（Vercel、CloudBase、Hugging Face） |

## 改动后怎么核对

- `pnpm test` 里的 `docs/test/site.test.ts` 有「一键部署模板」一组断言：模板存在、入口是 `.js`、
  依赖是 `latest`、没有 `workspace:`/`file:`、`cloudbaserc.json` 的 `functionRoot` 真实存在且
  运行时 ≥ Node 20。**先跑它**。
- 模板目录里的 `package.json` 不含 `name`/`version`（平台侧不需要，也避免被误当成待发布的包）。

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
| `edgeone-makers/`   | 腾讯云 EdgeOne Makers            | ZIP 内 `cloud-functions/index.js` | 控制台「直接上传」上传 ZIP                        | `packages/server-edgeone-makers` |

> 每个模板的目录形状跟着**平台约定**走，没有强行统一：Vercel 必须把函数放进 `api/`、
> CloudBase 按 `functionRoot/<函数名>/` 找代码、Lambda 需要一个能被 Terraform 整个打包的源码目录。
> 判据只有一条：**平台照文档里的路径能找到入口，且入口不需要构建**。

### `edgeone-makers/` 为什么是 ZIP 而不是目录

其余模板都是「目录 + 一行转发」的形态，EdgeOne Makers 不能照抄：平台只认
`cloud-functions/` 目录下的入口，而用户手上没有仓库，所以这里交付的是**可上传的 ZIP**。

ZIP 是**最小部署包**（三个文件，约 5 KB）：

| 路径 | 内容 |
| --- | --- |
| `cloud-functions/index.js` | 一行转发到 `@twikoojs/edgeone-makers`，映射到域名根路径 `/` |
| `cloud-functions/smtp.go` | SMTP 桥接（Go 函数，映射到 `/smtp`），供自建 SMTP 通道使用 |
| `package.json` | `dependencies: { "@twikoojs/edgeone-makers": "latest" }` |

这仍然满足上面三条硬约束：入口是纯 JS 转发壳、依赖写 `latest`、不引用 monorepo 内部路径。
实现由平台执行 `npm install` 取回（实测平台确实会跑），因此升级只需点「重新部署」。

`cloud-functions/smtp.go` 是本模板里唯一「源码直接进部署包」的文件 —— 平台按 `.go` 文件名
编译 Go 函数并生成同名路由，不会去 `node_modules` 里找 `.go`。

由 `packages/server-edgeone-makers/scripts/build-zip.mjs` 在构建期生成。
**不要手工改这个 ZIP**，改 `packages/server-edgeone-makers` 后重新构建即可。

ZIP 内**刻意不含** `index.html`：静态资源与函数路由冲突时静态资源优先，根目录出现
`index.html` 会让 `/` 返回网页，Twikoo 的 envId 随即失效。

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

# Development

> 本文面向本地二次开发。日常命令、目录↔包名对照表、能力矩阵、依赖规则等**权威说明在 [AGENTS.md](./AGENTS.md)**；文档站内容见 `docs/`（`pnpm --filter twikoo-docs docs:dev`）。

## 环境要求

| 项       | 要求                                             |
| -------- | ------------------------------------------------ |
| Node.js  | **26**（`.nvmrc` = 26；`engines.node` = `>=26`） |
| 包管理器 | pnpm（`packageManager` 字段已锁定版本）          |
| 构建目标 | ES2022（浏览器基线见文档站「浏览器支持」）       |

## 快速开始

```sh
pnpm install   # 安装工作区依赖
pnpm demo      # 一键启动本地演示（客户端 watch + tkserver + demo 页）
```

`pnpm demo` 会启动三个进程：

| 进程    | 内容                                        | 端口 |
| ------- | ------------------------------------------- | ---- |
| 客户端  | Vite watch，产出 4 个 UMD 产物              | —    |
| 后端    | `tkserver`（`packages/server-self-hosted`） | 8080 |
| demo 页 | Vite dev server（本地化的 bulma / katex）   | 9820 |

打开 `http://localhost:9820/demo.html` 即可。首次启动会自动生成测试数据（11 个场景，见 `.omo/evidence/t36-happy.md`），数据落在仓库根 `data/`，**删除该目录即可重置**。

> 依赖全部本地化（bulma / katex 来自 npm 依赖），断网也能跑起来。

## 常用命令

```sh
pnpm build          # 全仓构建（pnpm -r --if-present run build）
pnpm test           # 全仓单元测试（Vitest projects）
pnpm lint           # ESLint 9 flat
pnpm typecheck      # 逐包 tsc --noEmit
pnpm run check:no-js # 守卫：packages/*/src 下不得出现 .js 源码
pnpm env:check      # 环境变量清单校验（对照 .env.example）
```

单包命令用 `pnpm --filter <包名> <script>`，例如 `pnpm --filter tkserver test`、`pnpm --filter twikoo build`。**注意目录名 ≠ 包名**（`server-cloudbase` → `twikoo-func`、`server-common` → `@twikoojs/common`），对照表见 AGENTS.md。

## 测试

- 测试与实现同包存放（`packages/*/test/**`、`docs/test/**`），Vitest 通过根 `vitest.config.ts` 的 `projects` 自动发现各包的 `vitest.config.ts`；
- 覆盖率门禁：`@twikoojs/common` ≥ 80%、`twikoo` 客户端 ≥ 70%（各包 `vitest.config.ts` 内配置）；
- 需要真实外部依赖（SMTP、MongoDB、各平台密钥）的用例通过 `hasEnv()` 读取环境变量，缺失时**整体 skip**（不失败、不伪造密钥）；变量清单见根 `.env.example`。

## 环境变量

- 所有新增环境变量**必须**同步写入根 `.env.example`（`pnpm env:check` 会校验）；
- 本地测试所需的真实值写入根 `.env`（已 gitignore），**不要提交任何密钥**；测试代码中出现疑似密钥字面量会被 ESLint 直接拦下。

## 提交

- Conventional Commits（`feat|fix|chore|docs|test|build|ci|refactor` + scope）；
- 仅 `main` 分支；版本号由 CI 从 Release tag 注入，**禁止手工修改发布包的 `version`**（保持 `0.0.0`）。

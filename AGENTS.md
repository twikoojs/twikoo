# Twikoo 2.0 开发者指引（AGENTS.md）

> **本文档随各阶段完善（当前为 Wave 0 首版）。** 如发现与仓库现状不符，请以仓库实际状态为准并及时订正。

---

## 项目速览

Twikoo 是一个开源的静态网站评论系统。本仓库为 **2.0 重构**（monorepo 架构），基于 twikoo **1.7.24**（commit `62f9a93`）参考重写——参考行为与要点，非代码复制。

- **包管理器**：pnpm（12.x）+ pnpm-workspace.yaml
- **工作区规模**：17 个项目（根 + packages/* 下 15 包 + docs）
- **Node 基线**：Node **24**（`engines.node: ">=20"`；`.nvmrc` = 24；产物语法目标 **ES2022**）

### 目录 ↔ 包名对照表

| 目录 | 包名 | 类型 | 说明 |
| --- | --- | --- | --- |
| `packages/client` | **`twikoo`** | 发布 | 客户端（Vue3 + TS + Vite，UMD 输出） |
| `packages/server-cloudbase` | **`twikoo-func`** ⚠️ | 发布 | CloudBase 适配器（入口 `exports.main`，CloudBase 控制台依赖此名） |
| `packages/server-common` | **`@twikoojs/common`** ⚠️ | 发布 | 服务端公共逻辑（pipeline + 事件分发 + ports + 4 DB 实现） |
| `packages/server-vercel` | `twikoo-vercel` | 发布 | Vercel 适配器 |
| `packages/server-netlify` | `twikoo-netlify` | 发布 | Netlify 适配器 |
| `packages/server-self-hosted` | `tkserver` | 发布 | 自托管（Node.js HTTP） |
| `packages/pushoo` | `pushoo` | 发布 | 推送通道库（独立仓库源迁入） |
| `packages/shared` | `@twikoojs/shared` | 发布 | 版本占位符、事件常量、共享类型 |
| `packages/server-edgeone-makers` | `twikoo-edgeone-makers` | 私有 | EdgeOne Makers 适配器（不发布） |
| `packages/server-aws-lambda` | `twikoo-aws-lambda` | 私有 | AWS Lambda 适配器（不发布） |
| `packages/server-deta` | `twikoo-deta` | 私有 | Deta 适配器（不发布） |
| `packages/server-vercel-min` | `twikoo-vercel-min` | 私有 | Vercel 精简适配器（不发布） |
| `packages/pkg` | `twikoo-pkg` | 私有 | Node 24 SEA 打包流水线（非 HTTP 适配器） |
| `packages/tsup-config` | `@twikoojs/tsup-config` | 私有 | tsup 共享配置 |
| `packages/demo` | `@twikoojs/demo` | 私有 | 本地演示工程 |
| `docs` | `twikoo-docs` | 私有 | VitePress 文档站 |

> **⚠️ 最大陷阱**：目录名 ≠ 包名——`server-cloudbase` → **`twikoo-func`**、`server-common` → **`@twikoojs/common`**。所有代码中引用包名必须使用 `package.json` 里的 `name`，不可凭目录名推断。

---

## 常用命令

```bash
# 安装
pnpm install                # 工作区安装（首次约 11s）

# 构建（pnpm -r 递归执行）
pnpm build                  # → pnpm -r --if-present run build

# 测试 / Lint / 类型检查
pnpm test                   # → pnpm -r --if-present run test
pnpm lint                   # → pnpm -r --if-present run lint
pnpm typecheck              # → pnpm -r --if-present run typecheck

# 开发（需 T9 接线，当前为占位）
pnpm dev

# 演示（需 T35 接线，当前为占位）
pnpm demo

# 环境检查（需 T10 接线，当前为占位）
pnpm env:check
```

> **说明**：`build`/`test`/`lint`/`typecheck` 通过 `--if-present` 递归调用各包脚本——当某包尚未实现对应脚本时命令会自动跳过。`dev`/`demo`/`env:check` 需随各自波次接线后才真正可用。

> **Windows 开发者**：如遇 pnpm 脚本兼容性问题，请使用 `bash -lc "pnpm build"` 通过 Git Bash / WSL 执行。

---

## 环境准备

```bash
# 1. 确认 Node 版本
node -v                     # 应为 v24.x；engines >=20

# 2. 安装 pnpm（如尚未安装）
corepack enable && corepack prepare pnpm@12 --activate

# 3. 配置国内镜像（可选，开发者全局设置）
pnpm config set registry https://registry.npmmirror.com --global

# 4. 安装依赖
cd twikoo2 && pnpm install
```

> **D-10 说明**：镜像源仅推荐开发者在**全局**配置（`--global`）。仓库内 `.npmrc` **不写** `registry` 指令——CI 流水线默认使用 npm 官方源以保证一致性。如遇网络问题，可在 CI 的 `setup-node` step 中临时切换。

---

## 架构说明

Twikoo 2.0 分为三层：

```
客户端 (packages/client)                服务端公共层 (packages/server-common)           适配器 (8个, 各 <150行)
┌─────────────────────────────┐   ┌─────────────────────────────────────────┐   ┌──────────────────────┐
│  Vue 3 + TS + Vite          │──▶│  @twikoojs/common                       │──▶│ twikoo-func          │
│  4 个产物 (twikoo.all.min.js│   │  ├ ports (request/response/database/     │   │ twikoo-vercel        │
│  等, 文件名沿用 1.x)        │   │  │  storage/mailer/notifier/capabilities)│   │ tkserver             │
└─────────────────────────────┘   │  ├ pipeline + 事件 dispatcher (26 事件)  │   │ twikoo-netlify       │
                                  │  ├ 4 DB: Mongo / Loki / BlobKV / CB     │   │ twikoo-edgeone-makers│
                                  │  └ handler/services                     │   │ ... 等              │
                                  └─────────────────────────────────────────┘   └──────────────────────┘
```

### 26 事件机制

客户端通过 HTTP POST 发送事件名，服务端 dispatcher switch 分发到对应处理函数：

| 类别 | 事件名（示例） |
| --- | --- |
| 评论操作 | `COMMENT_SUBMIT` · `COMMENT_GET` · `COMMENT_LIKE` · `COMMENT_DELETE_FOR_USER` |
| 管理员操作 | `COMMENT_GET_FOR_ADMIN` · `COMMENT_SET_FOR_ADMIN` · `COMMENT_DELETE_FOR_ADMIN` · `COMMENT_IMPORT_FOR_ADMIN` · `COMMENT_EXPORT_FOR_ADMIN` |
| 统计 | `COUNTER_GET` · `GET_COMMENTS_COUNT` · `GET_RECENT_COMMENTS` |
| 配置/登录 | `GET_CONFIG` · `GET_CONFIG_FOR_ADMIN` · `SET_CONFIG` · `LOGIN` · `GET_PASSWORD_STATUS` · `SET_PASSWORD` |
| 验证码 | `CAP_CHALLENGE` · `CAP_REDEEM` |
| 邮件/上传/反垃圾 | `EMAIL_TEST` · `UPLOAD_IMAGE` · `GET_QQ_NICK` |
| 版本 | `GET_FUNC_VERSION` |
| 内部钩子 | `POST_SUBMIT`（内部钩子 + 1.x 兼容分支） |
| 可见性 | `HIDDEN` / `VISIBLE`（参数化 + 1.x 兼容分支） |

> 新增事件时须在前端 `api.ts`、`@twikoojs/common` dispatcher 及所有适配器中同步添加（适配器通过 common 统一分发，自身仅需声明 capabilities）。

---

## 适配器开发指南

每个服务端适配器是围绕 `@twikoojs/common` 的薄封装：

- **Ports 注入**：通过 `ports` 对象向 common 注入 `request` / `response` / `database` / `storage` / `mailer` / `notifier` / `capabilities`
- **代码行约束**：适配器目标 < **150 行**（`pkg` 除外——它是打包流水线，不适用此规则）
- **能力声明**：通过 `capabilities` 对象声明各模块是否可用（如 `domPurify`、`akismet`、`mail` 等）；edgeone-makers 能力受限（mail 受限、domPurify/akismet/tencentTms 不可用）
- **数据库**：由适配器在 ports 中注入数据库实现（MongoDB / LokiJS / BlobKV / CloudBase）

---

## 代码规范

### 硬性规则

- **每个函数、类方法、导出常量上方必须写中文注释**——描述用途，不重复签名
- TypeScript `strict` 模式，`noImplicitAny` / `noUncheckedIndexedAccess`
- 语法目标：**ES2022**（兼容 EdgeOne Makers 运行时 20.x）

### 工具链

- **ESLint 9** flat 配置（`vue3-recommended` + `typescript-eslint`）
- **Prettier**（`semi: true` · `singleQuote: false` · `trailingComma: "all"` · `printWidth: 100` · `tabWidth: 2`）
- **lint-staged** + **husky**（Git 钩子在 T3 波次接线）
- 提交信息格式：`feat(scope): description` / `fix(scope): description`（Conventional Commits）

---

## CSS 规范

- **禁止** `<style scoped>`——所有样式在 `<style>` 块内
- 所有类名统一使用 **`tk-` 前缀**（如 `.tk-submit`、`.tk-error`）
- 作用域挂 **`.twikoo`** 根选择器（`.twikoo .tk-submit { ... }`）
- **禁止** `.el-*` 类名（不再依赖 Element UI）
- 暗色主题通过 CSS 变量（`--tk-*`）切换，不通过类名切换

---

## 模块格式

| 位置 | 源码格式 | 产物格式 |
| --- | --- | --- |
| 公共包/适配器 | ESM + TS | 双格式：ESM（`.mjs`）+ CJS（`.cjs`） |
| 客户端 | ESM + TS | UMD（`twikoo.all.min.js` 等，文件名沿用 1.x） |
| 共享配置 | ESM + TS | 纯 TS（被其他包直接引用） |

### 重依赖加载策略

所有重依赖（见「依赖规则」节清单）一律通过 **`await import()`** 动态加载，**禁止在模块顶层使用 `import`**。原因：减小初始包体积、按需加载可选功能。

---

## 依赖规则

### 重依赖清单（全部 external + 动态加载）

`nodemailer` · `jsdom` + `dompurify` · `@imaegoo/node-ip2region` · `akismet-api` · `tencentcloud-sdk-nodejs-tms` · `form-data` · `axios` · `bowser` · `marked` · `xml2js` · `html-to-text` · `pushoo` · `@xsai/*`

### 声明方式

- **适配器**：按需在 `package.json` 的 `dependencies` 中声明实际使用的重依赖
- **`@twikoojs/common`**：通过 `peerDependenciesMeta`（`optional: true`）声明——由各适配器提供具体实现，common 只声明接口约束

### 禁止事项

- ❌ 禁止重依赖的顶层 `import`（必须用 `await import()`）
- ❌ 禁止在 `@twikoojs/common` 中硬依赖特定平台库

---

## 国际化（i18n）

- **一语言一文件**：每种语言一个独立模块，便于按需加载
- **内置语言**：`zh-CN`（中文简体）+ `en`（英文）——随客户端打包
- **7 分片**：按功能域拆分（评论、管理、配置、错误、验证码等），减少单文件体积
- **兜底语言**：`en`——当用户语言不在内置列表中时自动降级

> 参考 twikoo 1.x 的 i18n 结构重写为 TS 模块，新增 UI 文本须同步添加所有语言翻译。

---

## 版本与发布

### 版本号规则

- 8 个发布包的 `package.json` 中 `version` **恒为 `0.0.0`**
- **version 字段恒为 `0.0.0`，禁止任何改动**——CI 在发布时从 Release tag 自动注入实际版本号
- 这是设计决策（D-13）：所有发布包统一版本号，避免多包版本同步的人工成本

### 发布流程

1. **GitHub Release 由人创建**，CI 只响应——不自动创建 Release / tag（D-21）
2. `release: published` 触发 `release.yml`
3. **两阶段发布**：
   - 第一批：`@twikoojs/common` → `@twikoojs/shared` → `pushoo` → `twikoo`
   - 第二批：`twikoo-func` → `twikoo-vercel` → `tkserver` → `twikoo-netlify`（等第一批在 npm 可见后）
4. 每阶段发布后执行 `verify-npm` gate
5. Pre-release 自动打 `beta` tag

---

## 测试

### 框架

- **Vitest**（不使用 Jest）
- 配置随 T3 波次接线

### 契约测试

- 覆盖全部 **26 个事件**——验证每个事件的请求/响应契约（字段结构、必填项、错误码）
- 适配器需通过同一套契约测试（在各自运行时下）

### 覆盖率门禁

| 包 | 最低行覆盖率 |
| --- | --- |
| `@twikoojs/common` | ≥ **80%** |
| 客户端 | ≥ **70%** |

### `.env` 机制

- 通过 `.env` 文件注入敏感配置（数据库连接串、API Key 等）
- `hasEnv()` 函数检测环境变量是否已设置——未设置时对应测试自动跳过（`skip`），不报错
- `env:check` 命令（需 T10 接线）验证必要环境变量是否就绪

---

## 错误处理

### 服务端

- 统一错误体结构：`{ code: string; message: string }`
- `code` 使用模块化的命名空间（如 `COMMENT_NOT_FOUND`、`CONFIG_SET_FAILED`）

### 客户端（`TwikooError`）

| kind | 说明 |
| --- | --- |
| `NETWORK` | 网络连接失败（断网、DNS 解析错误） |
| `CORS` | 跨域请求被浏览器拦截 |
| `TIMEOUT` | 请求超时 |
| `REJECTED` | 服务端拒绝请求（非 2xx 响应） |
| `NOT_FOUND` | 请求目标不存在（404） |
| `CLIENT_ERROR` | 客户端参数错误（4xx，除 CORS/404） |
| `SERVER_ERROR` | 服务端内部错误（5xx） |
| `UNKNOWN` | 无法归类的其他错误 |

> 每个错误对象附带 `httpStatus` / `rawMessage` / `hintKey` / `solutionsKey` / `logText` 字段，支持前端渲染内联错误卡片与可折叠详情。

---

## 向后兼容（BC）

### 分支保留策略

| 兼容分支 | 当前行为 | 移除时间 |
| --- | --- | --- |
| `POST_SUBMIT` | 作为内部钩子 + 1.x 调用方兼容分支 | **2.2.0** |
| `HIDDEN` / `VISIBLE` | 统一为 `COMMENT_GET_FOR_ADMIN` 参数，保留独立 switch 分支 | **2.2.0** |

### 包名不变

所有对外包名（含未发布的 `twikoo-edgeone-makers`）保持不变：
`twikoo` · `twikoo-func` · `twikoo-vercel` · `twikoo-netlify` · `tkserver` · `twikoo-edgeone-makers` · `pushoo` · `@twikoojs/shared`

### twikoo-func 转发导出

`twikoo-func`（`packages/server-cloudbase`）保留一层 `export * from '@twikoojs/common'` 过渡壳（BC-12），待 2.2.0 移除。

---

## 常见坑

### 1. twikoo-func 的 `main` 导出名不可改

`twikoo-func` 的 `exports.main` 是 CloudBase 控制台硬依赖——CloudBase 运行时通过 `require('twikoo-func').main` 加载云函数入口。重命名或移除此导出会导致所有 CloudBase 部署失效。

### 2. 目录名 ≠ 包名

`packages/server-cloudbase` 的包名是 **`twikoo-func`**；公共逻辑在 **`packages/server-common`** → **`@twikoojs/common`**。导入时必须使用包名，不可使用相对路径或凭目录名猜测。

### 3. pnpm allowBuilds

pnpm 12 默认阻止依赖的构建脚本（如 esbuild）。首次安装或新增依赖触发 `ERR_PNPM_IGNORED_BUILDS` 时，需在 `pnpm-workspace.yaml` 的 `allowBuilds` 中显式授权（如 `esbuild: true`）。

### 4. Windows 开发兼容

Windows 环境下 pnpm 脚本可能遇到路径或 shell 兼容问题。推荐使用 `bash -lc` 通过 Git Bash / WSL 执行 pnpm 命令：

```bash
bash -lc "pnpm build"
```

### 5. version 字段禁止人为修改

任何 `package.json` 中的 `version` 字段必须保持 `"0.0.0"`。版本号由 CI 在发布阶段从 Release tag 注入。任意修改会导致 CI 版本不一致。

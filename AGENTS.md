# Twikoo 2.0 开发者指引

本文面向本地二次开发，文档站内容见 `docs/`。

## 项目速览

Twikoo 是一个开源的静态网站评论系统。

## 环境要求

- Node.js 26
- pnpm

## 快速开始

```sh
pnpm install # 安装工作区依赖
pnpm demo # 一键启动本地演示（客户端、私有部署服务端、演示页）
```

### 目录 ↔ 包名对照表

目录名 ≠ 包名，所有代码中引用包名必须使用 `package.json` 里的 `name`，不可凭目录名推断。

```
twikoo/
├── packages/
│   ├── shared/                # @twikoojs/shared        ← 前后端共享类型与常量
│   ├── tsdown-config/         # @twikoojs/tsdown-config ← 共享构建积木
│   ├── client/                # twikoo                  ← 前端库
│   ├── server-common/         # @twikoojs/common        ← 公共后端库，核心交付
│   ├── server-aws-lambda/     # twikoo-aws-lambda       ← AWS Lambda 适配器
│   ├── server-cloudbase/      # twikoo-func             ← 腾讯云 CloudBase 适配器
│   ├── server-deta/           # twikoo-deta             ← Deta 适配器
│   ├── server-edgeone-makers/ # twikoo-edgeone-makers   ← EdgeOne Makers 适配器
│   ├── server-netlify/        # twikoo-netlify          ← Netlify 适配器
│   ├── server-vercel/         # twikoo-vercel           ← Vercel 适配器
│   ├── server-vercel-min/     # twikoo-vercel-min       ← Vercel 精简适配器
│   ├── server-self-hosted/    # tkserver                ← 私有部署适配器
│   ├── pkg/                   # twikoo-pkg              ← SEA 可执行产物打包流水线，产出私有部署可执行程序
│   ├── demo/                  # @twikoojs/demo          ← 本地演示工程
│   └── pushoo/                # pushoo                  ← 推送通道库
└── docs/                      # twikoo-docs             ← VitePress 文档站
```

## 常用命令

```bash
pnpm build # 全仓构建
pnpm test # 全仓单元测试
pnpm lint # ESLint
pnpm typecheck # 逐包 tsc --noEmit
pnpm release:check # 发布基线：8 个发布包 version 必须为 0.0.0
pnpm e2e:b2 # 端到端回归
pnpm check:products # 客户端四产物逐一 init + 形态断言 + tkserver 启动/shutdown
```

> `pnpm e2e:b2` 与 `pnpm check:products` 都需要先 `pnpm build`（消费 `packages/client/dist/*`
> 与 `packages/server-self-hosted/dist/server.js`），**不属于** `pnpm test`（各自耗时约 20s，
> 且会起真实端口 8123 / 8124）。
>
> - `e2e:b2` 覆盖「加载更多 / 排序 / 点赞 / 提交 / 错误卡片 / i18n / 管理员登录与配置读写 /
>   管理端检索」等检查项，是服务端语义层回归的**第一道防线**（曾由它发现
>   `created $lt` 分页与 `COMMENT_GET_FOR_ADMIN` 缺 `count` 两个真实缺陷）；
> - `check:products` 覆盖「CDN 四产物」与「自托管启动/全功能/SIGTERM shutdown」。
>
> 真机平台（CloudBase/Vercel/Netlify/AWS/Deta/EO/Docker/pkg/HF Space）的**人工**验证清单见
> 仓库根 `VERIFICATION.md`（含回填栏与失败登记区）。

单包命令：`pnpm --filter <包名> <script>`（如 `pnpm --filter tkserver test`、`pnpm --filter twikoo build`、`pnpm --filter twikoo-docs docs:build`）。

> `dev` 仍为占位（本地开发统一走 `pnpm demo`）。
> **Windows 开发者**：如遇脚本 shell 兼容问题，可用 `bash -lc "pnpm build"` 通过 Git Bash 执行。

## 架构说明

```
客户端 (packages/client)              服务端公共层 (packages/server-common)        适配器 (8 个)
┌──────────────────────────────┐  ┌────────────────────────────────────────┐  ┌────────────────────────┐
│ Vue3 + TS + Vite             │─▶│ @twikoojs/common                       │─▶│ twikoo-func (CloudBase)│
│ 4 个 UMD 产物（文件名沿用 1.x）│  │ ├ ports（request/response/database/     │  │ twikoo-vercel          │
│ twikoo[.all][.nocss].min.js  │  │ │  storage/mailer/notifier/capabilities)│  │ tkserver               │
│ + twikoo.css                 │  │ ├ pipeline + dispatcher（25 事件）      │  │ twikoo-netlify         │
└──────────────────────────────┘  │ ├ 4 DB：Mongo/Loki/BlobKV/CloudBase     │  │ aws-lambda / deta / EO │
                                  │ └ handlers / services                   │  │ vercel-min（转发壳）    │
                                  └────────────────────────────────────────┘  └────────────────────────┘
```

### 25 事件机制

客户端通过 HTTP POST 发送事件名，服务端 dispatcher 分发到对应 handler：

- 评论操作
  - `COMMENT_SUBMIT`
  - `COMMENT_GET`
  - `COMMENT_LIKE`
  - `COMMENT_DELETE_FOR_USER`
- 管理员操作
  - `COMMENT_GET_FOR_ADMIN`
  - `COMMENT_SET_FOR_ADMIN`
  - `COMMENT_DELETE_FOR_ADMIN`
  - `COMMENT_IMPORT_FOR_ADMIN`
  - `COMMENT_EXPORT_FOR_ADMIN`
- 统计
  - `COUNTER_GET`
  - `GET_COMMENTS_COUNT`
  - `GET_RECENT_COMMENTS`
- 配置/登录
  - `GET_CONFIG`
  - `GET_CONFIG_FOR_ADMIN`
  - `SET_CONFIG`
  - `LOGIN`
  - `GET_PASSWORD_STATUS`
  - `SET_PASSWORD`
- 验证码
  - `CAP_CHALLENGE`
  - `CAP_REDEEM`
- 邮件/上传/反垃圾
  - `EMAIL_TEST`
  - `UPLOAD_IMAGE`
  - `GET_QQ_NICK`
- 版本
  - `GET_FUNC_VERSION`
- 服务端内部事件（**非兼容分支，长期保留**）
  - `POST_SUBMIT`

> 新增事件须在客户端 `api.ts`、`@twikoojs/common` dispatcher 中同步添加；适配器经 common 统一分发，只需声明 capabilities。
>
> **共 25 个事件标识符**：24 个由客户端发起 + 1 个服务端内部事件 `POST_SUBMIT`。
> ⚠️ 曾一度把 `HIDDEN` / `VISIBLE` 也列为事件（`ALL_EVENTS` 达 27 项），**那是臆造**——
> 二者只是 `COMMENT_GET_FOR_ADMIN` 请求体里 `type` 字段的取值（1.x
> `getCommentSearchCondition` 的嵌套 switch + 客户端 `TkAdminComment.vue` 的筛选下拉），
> 1.x 从未把它们作为事件分发。已删除，`type` 参数机制不变。

#### `POST_SUBMIT`：把耗时副作用移出用户请求预算

`COMMENT_SUBMIT` 保存评论后的垃圾检测（Akismet / 腾讯云 TMS）与通知（SMTP + pushoo）
**绝不能内联 `await`**——否则一是用户要等整条链，二是超出云函数执行时间上限时
**整个调用失败**，而评论其实已经入库：客户端报错、用户重试还会产生重复评论。

因此 common 只负责**逻辑**（`services/post-submit.ts`），**触发方式**由适配器经
`TkAdapters.postSubmit` 端口决定（见 `ports/post-submit.ts` 的机制对照表）：

| 平台                           | 机制                                                      | 用户等待 |
| ------------------------------ | --------------------------------------------------------- | -------- |
| self-hosted / deta / eo-makers | 进程内直调服务，不 `await`（`scaffoldAdapters` 默认实现） | 0        |
| CloudBase                      | `app.callFunction` 递归自调用（`timeout: 300` 实现异步）  | ~300ms   |
| Vercel / Netlify               | HTTP 递归自调用（有界竞速 5s）                            | ≤5s      |
| AWS Lambda                     | `InvokeCommand` + `InvocationType: "Event"`（平台级异步） | ~0       |

目标执行单元经 `POST_SUBMIT` 事件进入，处理器会**校验内部派发令牌**
（`x-twikoo-recursion` 头 === `config.ADMIN_PASS || "true"`，1.x 语义）——
不符即 1403 拒绝，防止外部凭空触发垃圾检测与邮件/IM 通知。

> 各平台的具体机制与 1.x 对照见 `ports/post-submit.ts` 头注释；netlify / aws-lambda
> 在 1.x 是 `require('twikoo-vercel')` 转发壳、自调用实际发不出去，2.0 已改为
> 各自的正确机制。

### 适配器能力矩阵（八项能力）

| 能力        | 全能力适配器 | EdgeOne Makers                                    |
| ----------- | ------------ | ------------------------------------------------- |
| mail        | ✅           | ⚠️ 受限：SendGrid / MailChannels / Go SMTP Bridge |
| domPurify   | ✅           | ❌ 直通（内容原样存储）                           |
| ip2region   | ✅           | ✅                                                |
| akismet     | ✅           | ❌                                                |
| tencentTms  | ✅           | ❌                                                |
| imageUpload | ✅           | ✅                                                |
| qqAvatar    | ✅           | ✅                                                |
| ai          | ✅           | ✅                                                |

全能力适配器：`twikoo-func` / `twikoo-vercel` / `twikoo-netlify` / `tkserver` / `twikoo-aws-lambda` / `twikoo-deta`（`twikoo-vercel-min` 转发复用 vercel）。未声明能力时 common 返回**用户友好错误**（`CapabilityError`），绝不触发模块解析。

---

## 适配器开发指南

- **Ports 注入**：`request` / `response` / `database` / `storage` / `mailer` / `notifier` / `postSubmit` / `capabilities`
- **保持薄**：适配器只做「入口 + 适配器注入 + 平台载荷转换」，业务逻辑一律进 `@twikoojs/common`。原「< 150 行」硬门禁已移除（过严，妨碍平台机制落地），改为**人工约定**；平台专属代码多时按职责拆文件（如 cloudbase 的 `transform.ts` / `dispatch.ts` / `types.ts`）。
- **入口约定**：`createXxxFunc({ database? })` / `createXxxHandler()`；`twikoo-func` 必须保留 `exports.main`（CloudBase 硬依赖）
- **依赖完整性**：重依赖在适配器 `dependencies` 中声明，按 capabilities 人工核对（8 个适配器；无自动守卫）
- **懒加载解析**：common 的重依赖经 `await import(specifier)` 加载，解析基准是**适配器所在位置**——`@twikoojs/common` 已把 16 个重依赖声明为 `peerDependenciesMeta.optional`，pnpm isolated 链接下才会在 common 侧可见（修复的真实缺陷）

---

## 代码规范

### 硬性规则

- **每个函数、类方法、导出常量上方必须写中文注释**（ESLint `jsdoc/require-jsdoc` 强制，含 `export const` 与对象方法）
- TypeScript `strict`；语法目标 **ES2022**（浏览器基线 Chrome/Edge 94+、Firefox 93+、Safari 15.4+）
- **`packages/*/src` 下不得出现 `.js`/`.mjs`/`.cjs` 源码**（人工约定，无自动守卫）
- 提交信息：Conventional Commits（`feat|fix|chore|docs|test|build|ci|refactor` + scope）

### 工具链

- **ESLint 9** flat（`vue3-recommended` + `typescript-eslint` type-checked + `eslint-plugin-jsdoc`）
- **Prettier**（`semi` · 双引号 · `trailingComma: "all"` · `printWidth: 100` · `tabWidth: 2`）
- **无本地提交钩子**：`lint-staged` / `simple-git-hooks` 及 `prepare` 生命周期脚本已移除，仓库不再安装
  pre-commit 钩子——规范一律由 **GitHub Actions 的 CI 门禁**把关（`lint` / `typecheck` / `test` /
  `build` 四个并行 job）。本地提交前请自行跑 `pnpm lint`（必要时
  `pnpm lint:fix`）与 `pnpm prettier --write <files>`。`prettier` 依赖与 `.prettierrc.json` 保留，
  供手动格式化（注意本机 `pnpm exec <bin>` 不可用，见「常见坑」第 4 条）。
- **草稿 PR 不跑 CI**：4 个 job 均带 `if: github.event.pull_request.draft == false`，
  且 `on.pull_request.types` 显式含 `ready_for_review`。**这两者缺一不可**——
  少了 `types` 里的 `ready_for_review`，草稿点「Ready for review」不会触发工作流，
  CI 要等下一次 push 才启动（静默空档）。`push` 事件下 `github.event.pull_request` 为 null，
  GitHub 表达式为宽松相等（null→0、false→0），故 `null == false` 求值为 true，
  push 到 main 不受影响。
- **Vitest 5**（工作区模式：根 `vitest.config.ts` 的 `projects` 发现各包 `vitest.config.ts`）

---

## CSS 规范

- **禁止** `<style scoped>`（本地 ESLint 规则 `twikoo/no-scoped-style` 强制）
- 类名统一 **`tk-` 前缀**（如 `.tk-submit`、`.tk-error`、`.tk-owo-emotion`）
- 作用域挂 **`.twikoo`** 根选择器（`.twikoo .tk-submit { ... }`）
- **禁止** `.el-*` 类名（不再依赖 Element UI；自研组件参考 Element UI 改写，见 `packages/client` 的 NOTICE）
- 暗色主题通过 CSS 变量切换

---

## 模块格式

| 位置          | 源码格式 | 产物格式                                      |
| ------------- | -------- | --------------------------------------------- |
| 公共包/适配器 | ESM + TS | 双格式：ESM（`.mjs`）+ CJS（`.cjs`/`.js`）    |
| 客户端        | ESM + TS | UMD（`twikoo.all.min.js` 等，文件名沿用 1.x） |
| 共享配置      | ESM + TS | 纯 TS（被其他包直接引用）                     |

### 构建配置文件名（`.ts` / `.mts`）必须与 `package.json` 的 `type` 对齐

| `package.json` `type` | 配置文件名          |
| --------------------- | ------------------- |
| `"module"`            | `tsdown.config.ts`  |
| 未声明（CJS 侧）      | `tsdown.config.mts` |

tsdown 用 Node 原生加载器 import 配置文件；未声明 `type` 的包里 `.ts` 属「模块类型未指定」，
Node 会打印 `[MODULE_TYPELESS_PACKAGE_JSON]` 告警（并按 CJS 解析失败）。改扩展名即可消除。

⚠️ **不要**改为给这些包补 `"type": "module"`：`outExtensions()` 的产物命名契约正是按 `type` 分档的
（未声明时 CJS 产物为 `dist/index.js`，`tkserver` 的 `bin` 依赖 `dist/server.js`），补上会变成 `.cjs`
而破坏 `exports` / `bin` / CloudBase 的 `exports.main`。

改名时要同步两处（漏了 lint 会直接失败，不是告警）：

1. 该包 `tsconfig.json` 的 `include`（`tsdown.config.mts`）——否则 typescript-eslint 的
   projectService 判定「不属于任何项目」而解析失败；
2. `eslint.config.js` 第 5 段 `twikoo/skip-typecheck-configs-and-tests` 的 `files` glob
   （已含 `**/*.config.ts` 与 `**/*.config.mts`）。

### 双格式产物的 `exports: "named"`

入口同时有命名导出与 `export default` 时，rolldown 对 **CJS** 输出打印 `[MIXED_EXPORTS]`。
属此形态的包（`pushoo`、`server-vercel`）在配置里显式声明：

```ts
outputOptions: (options, format) => (format === "cjs" ? { ...options, exports: "named" } : options),
```

这只是把 `auto` 的既有推断结果写实（**产物逐字节不变**），并锁住 `.notice` / `.default` 两个访问形态。
不要写成 `"default"`，也不要加到「只有默认导出」的包上——那会改变 CJS 互操作形态。

### 动态 import 的纪律

- **只对重依赖用动态 `import()`**（`@twikoojs/common` 经 `utils/lib-loader.ts` 的变量 specifier 间接加载，
  见其头注释），目的是能力门 + 「未安装也不在加载期崩」；
- `utils/lib-loader.ts` 自身是薄取用层，**一律静态导入**——动态导入它只会得到
  `[INEFFECTIVE_DYNAMIC_IMPORT]`（同包多处已静态引入，无法拆 chunk），惰性收益为零；
- 常规 `dependencies`（如 `@cap.js/server`）**不要**用动态导入假装惰性：其消费方处理器若已被
  静态注册（`handlers/index.ts`），模块必然进主 chunk，动态导入同样无效。

---

## 依赖规则

### 重依赖清单（全部 external + 动态加载）

`nodemailer` · `jsdom` + `dompurify` · `@imaegoo/node-ip2region` · `akismet-api` · `tencentcloud-sdk-nodejs-tms` · `form-data` · `axios` · `bowser` · `marked` · `xml2js` · `html-to-text` · `pushoo` · `@xsai/*` · `lokijs` · `mongodb`

### 声明方式

- **适配器**：按需在 `dependencies` 中声明实际使用的重依赖（按 capabilities 人工核对，`marked` 亦在通用清单内）
- **`@twikoojs/common`**：16 个重依赖统一以 `peerDependencies` + `peerDependenciesMeta.optional` 声明——既表达接口约束，又让 pnpm 把它们链接到 common 侧（否则 isolated 链接下动态 import 必然 MODULE_NOT_FOUND）

### 禁止事项

- ❌ 重依赖顶层静态 `import`（`packages/server-common/src/**` 由 ESLint `no-restricted-imports` 强制）
- ❌ 在 `@twikoojs/common` 中硬依赖特定平台库
- ❌ 手工修改任何发布包 `package.json` 的 `version`（见「版本与发布」）

---

## 国际化（i18n）

- **一语言一文件**：`packages/client/src/i18n/locales/*.json`，共 **9 个 locale**（zh-CN、zh-HK、zh-TW、en、ja-JP、ko-KR、vi-VN、id-ID、uz-UZ），各 **196 键**
- **真相源**：`locales/_keys.json`（键集合），`TranslationKey` 类型保证缺键时 tsc 报错
- **兜底**：`en`——缺键或分片加载失败时降级英文，绝不阻塞渲染
- **语言别名**：`zh` → `zh-CN`、`en-GB` → `en` 等（1.x langs 表语义）
- 新增 UI 文本须同步补齐全部 9 种语言

### 打包与按需加载

| 语言           | 打包方式                                                                |
| -------------- | ----------------------------------------------------------------------- |
| `zh-CN` / `en` | **内置**进主产物（`en` 同时是 fallback 源）                             |
| 其余 7 种      | 各自一个独立分片 `dist/locales/<lang>.js`（ESM），运行时按需 `import()` |

- 分片由 `packages/client/build.mjs` 的 `buildLocaleShards()` 单独构建——主产物是 UMD，**不支持代码分割**，
  故分片不能与主产物同批产出。
- 主产物里必须保留**原生 `import()`**：`rollupOptions.output.dynamicImportInCjs: false`
  （Rollup 对 UMD 输出默认把 `import()` 改写成 `require()` 包装，浏览器没有 `require` 会直接失败）。
- 分片基址从**主脚本自身 URL** 推导（UMD 无 `import.meta.url`）：`document.currentScript.src` →
  回退扫描 `script[src]` 中含 `twikoo` 者；可用 `init({ localeBaseUrl })` 或 `setLocaleBaseUrl()` 显式覆写。
- 任何加载失败（网络 / 404 / 解析 / 基址推导失败）**一律回退英文并记 warn，绝不抛出**。
- `init()` 在挂载前 `await loadLanguage(options)`，因此组件渲染时语言已就位，**无需「加载后重渲染」**。
- ⚠️ **不要把 7 个分片重新静态 import 回 `i18n/index.ts`**——那会让全部语言重新进主产物（体积 +120KB）。

---

## 版本与发布

### 版本号规则

- **8 个发布包的 `version` 恒为 `0.0.0`**，禁止任何改动（`pnpm release:check` 与 `release.yml` 的基线校验步骤会拦）
- 版本号由 CI 在发布时从 **Release tag** 注入（`strip /^v/`），不进入 git
- `pushoo` 不再维护独立版本线：与 `twikoo` 同版本发布，其变更随 twikoo 版本一起出去

### 发布流程（`release.yml`）

1. **人在 GitHub 网页创建 Release**（tag 即版本号；勾选 pre-release → npm `beta` dist-tag）——CI **不创建** Release/tag，也无 `workflow_dispatch`
2. `release: published` 触发 `release.yml`：版本格式 → 8 包基线 → **单调性**（新版本必须大于已发布的最高同线版本）→ 未发布过
3. **两阶段发布**（依赖关系强制分批）：
   - 第一批：`@twikoojs/shared` · `@twikoojs/common` · `pushoo` · `twikoo`
   - gate：`verify-npm`（600s / 15s 轮询）确认第一批在 npm 可见
   - 第二批：`twikoo-func` · `twikoo-vercel` · `tkserver` · `twikoo-netlify`
   - gate：8 包全部可见
4. 收尾（仅正式版）：`publish-docker`（`imaegoo/twikoo:latest` / `:VERSION` / `:arm32v7`）、`publish-pkg`（SEA 产物用 `gh release upload` 挂到**已有** Release）
5. 发布脚本：`scripts/release-set-version.mjs`（基线校验 / 覆写）、`release-version-check.mjs`（单调性 / 未发布过）、`verify-npm.mjs`（可见性 gate）

> **实际操作请照 `RELEASE.md` 走**（发布前本地检查清单 → 网页创建 Release → 观察两阶段 →
> 发布后核验 → **回滚**）。前置条件（仓库 secrets）以 `RELEASE.md` 为准，其中
> `NPM_TOKEN` 是发布硬依赖：工作流把它注入 `NODE_AUTH_TOKEN`，缺失会直接 ENEEDAUTH。

### 文档站发布（`docs.yml`）

push 到 `main` 且改动 `docs/**`、或 Release published、或手动触发 → VitePress 构建 → `imaegoo/vuepress-deploy` 推 `gh-pages`（CNAME `twikoo.js.org`）。

### Docker / pkg

- `Dockerfile`：**从 workspace 构建**（多阶段，`pnpm --filter "tkserver..." build`），运行 `node packages/server-self-hosted/dist/server.js`，`TWIKOO_DATA=/app/data`
- `packages/pkg`：tsdown + SEA，`exe.targets[].nodeVersion` = **26.9.0**（目标运行时 = 仓库基线；**必须是完整 `x.y.z`**，写主版本会被 `@tsdown/exe` 拒绝）；**构建宿主需 Node ≥ 25.7**

---

## 测试

### 框架与组织

- **Vitest 5**；各包 `vitest.config.ts` 由根配置 `projects` 自动发现（含 `docs/vitest.config.ts`）
- 测试与实现同包：`packages/*/test/**`、`docs/test/**`
- 契约测试：`@twikoojs/common` 的共享契约套件覆盖全部 25 事件，各适配器复用

### 覆盖率门禁

| 包                 | 最低语句覆盖率 |
| ------------------ | -------------- |
| `@twikoojs/common` | ≥ **80%**      |
| `twikoo`（客户端） | ≥ **70%**      |

> **客户端覆盖率口径（审计建议 #1 的处置）**：`packages/client/vitest.config.ts` 的 `coverage.include` 仅含 `src/**/*.ts`，**刻意排除 `.vue` 组件**。原因：SFC 经 `@vitejs/plugin-vue` 编译插桩后整体语句覆盖率仅约 55%，低于 70% 门禁；组件行为已由 `test/components.test.ts` / `test/tk-components.test.ts` 等功能用例覆盖，故显式收窄口径避免门禁误伤。如后续补组件行覆盖率，需同步下调阈值或新增组件测试，二者择一。

### `.env` 机制（硬规则）

- 变量清单的**唯一真相源是根 `.env.example`**（当前 23 个：密钥类 14 + 默认值类 9）
- **硬规则：新增任何环境变量，必须同步更新 `.env.example`**（含用途注释与「缺失时哪些用例会 skip」；人工核对，无自动守卫）
- 测试通过 `hasEnv()` 判定「空字符串 = 未配置」→ 对应用例**整体 skip**（不失败、不伪造密钥）；本地真实值写入根 `.env`（已 gitignore）
- 测试代码中出现疑似密钥字面量会被 ESLint 直接拦下（`test-secret-literal-ban`）

---

## 错误处理

### 服务端

- 统一响应体：`{ code: number, ... }`；`RES_CODE` 数值是**对外契约**（0 成功 / 1000 通用失败 / 1403 禁止 …），禁止改动数值
- 缺少依赖、缺少能力等均返回**可读错误**（如「缺少依赖 jsdom，请在当前适配器中安装」），不暴露 MODULE_NOT_FOUND

### 客户端（`TwikooError` 八分类）

| kind           | 说明                               |
| -------------- | ---------------------------------- |
| `NETWORK`      | 网络连接失败（断网、DNS 解析错误） |
| `CORS`         | 跨域请求被浏览器拦截               |
| `TIMEOUT`      | 请求超时                           |
| `REJECTED`     | 服务端拒绝请求（非 2xx 响应）      |
| `NOT_FOUND`    | 请求目标不存在（404）              |
| `CLIENT_ERROR` | 客户端参数错误（4xx，除 CORS/404） |
| `SERVER_ERROR` | 服务端内部错误（5xx）              |
| `UNKNOWN`      | 无法归类的其他错误                 |

每个错误对象附带 `httpStatus` / `rawMessage` / `hintKey` / `solutionsKey` / `logText`，评论区渲染**内联错误卡片** + 可折叠详情；日志分级由 `TWIKOO_LOG_LEVEL` 控制。排障对照表见文档站「常见问题 → 常见错误排查」。

---

## 向后兼容（BC）

### 包名不变

`twikoo` · `twikoo-func` · `twikoo-vercel` · `twikoo-netlify` · `tkserver` · `pushoo` · `@twikoojs/shared` · `@twikoojs/common`（新增）。`twikoo-edgeone-makers` 等私有包名亦不变。

### 兼容分支与过渡层

| 兼容项                 | 当前行为                                                        | 移除时间  |
| ---------------------- | --------------------------------------------------------------- | --------- |
| `twikoo-func` 转发导出 | 保留 `export * from "@twikoojs/common"` + `console.warn` 过渡壳 | **2.2.0** |
| `README.en.md`         | 已删除（中文移至 `README_zh_CN.md`）——外部死链需公告            | 已发生    |
| CloudBase CLI 部署     | 已移除（仅保留控制台流程）——CLI 用户需改用控制台                | 已发生    |

> `POST_SUBMIT` **不在此列**：它曾被误判为兼容分支，实际是后置副作用链的执行入口
> （见「25 事件机制」小节），长期保留。
>
> `HIDDEN` / `VISIBLE` **也不在此列**：二者从来不是事件，只是 `COMMENT_GET_FOR_ADMIN`
> 的 `type` 取值（重构期曾被误加为兼容事件分支，已删除）。

---

## 常见坑

1. **`twikoo-func` 的 `main` 导出名不可改**：CloudBase 控制台通过 `require("twikoo-func").main` 加载入口，改名或删除会导致所有 CloudBase 部署失效。
2. **目录名 ≠ 包名**：见上方对照表；`server-cloudbase` → `twikoo-func`、`server-common` → `@twikoojs/common`。
3. **重依赖在 common 侧不可见**：只把重依赖写进适配器 `dependencies` 不够——common 的动态 `import()` 以自身位置解析，必须同时在 common 的 `peerDependencies`(+`optional`) 中声明（实测：`COMMENT_SUBMIT` 曾因 jsdom 解析失败返回 1000）。
4. **`pnpm exec <bin>` 在部分环境失效**：改用 `node_modules/.bin/<bin>` 或 `pnpm run <script>`。仓库已不装 pre-commit 钩子，提交前请手动执行等价检查（`pnpm lint` + `pnpm prettier --write`）。
5. **`version` 字段禁止人为修改**：保持 `0.0.0`，由 CI 从 Release tag 注入；`pnpm release:check` 与 `release.yml` 的基线校验步骤会拦。
6. **新增 env 变量必须同步 `.env.example`**：无自动守卫，需人工核对。
7. **CSS 不得用 `<style scoped>`、不得出现 `.el-*`**：见 CSS 规范（均有 ESLint 规则）。
8. **`packages/*/src` 不得新增 `.js`**：重写模式全量 TS（人工约定，无自动守卫）。
9. **Windows 开发**：pnpm 脚本可能遇到 shell 兼容问题，可用 `bash -lc "pnpm ..."`。
10. **workflow 改动需人工核对**：留意 `type:` / `types:` 这类易错点（原 actionlint + 结构断言守卫已移除）。典型陷阱：给 CI 加「草稿 PR 不跑」时只加 `if: github.event.pull_request.draft == false` 而漏了 `on.pull_request.types` 里的 `ready_for_review`——草稿转可评审时**不会触发工作流**，CI 要等下一次 push 才启动，属静默失效。

---

## 2.2.0 移除清单（待办登记）

以下为 2.0 **有意保留**的向后兼容项，计划在 **2.2.0 移除**；移除前需提前公告（属 breaking change）：

| #   | 待移除项                                 | 位置                                    | 移除前置动作                                      |
| --- | ---------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| 1   | `twikoo-func` 转发导出过渡壳             | `packages/server-cloudbase` 入口        | 确认无外部依赖后移除 `export *` 与 `console.warn` |
| 2   | `pushoo` 旧独立版本线（`0.1.x`）兼容说明 | `packages/pushoo/README.md` / CHANGELOG | 2.0 已并入统一版本线，2.2.0 起可删除迁移公告      |
| 3   | `README.en.md` 死链公告                  | CHANGELOG                               | 公告期结束后可移出「最近变更」区                  |

> 维护约定：任何兼容分支都必须在**本文档与 CHANGELOG 同时登记**并注明移除版本；移除时同步更新文档站「服务端事件」与 README 迁移说明。
> **不要把 `POST_SUBMIT` 登记为兼容分支**——它是长期机制（见「25 事件机制」小节）。
> **也不要把 `HIDDEN` / `VISIBLE` 登记进来**——它们不是事件，只是 `type` 取值。

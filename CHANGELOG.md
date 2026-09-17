## 更新日志 | Release notes

- [twikoo 2.0.0-beta.1](#twikoo-200-beta1--2026-09-17)（2026-09-17）
- 1.x 及更早版本：见 [GitHub Releases](https://github.com/twikoojs/twikoo/releases)

---

## twikoo 2.0.0-beta.1 ·（2026-09-17）

Twikoo 2.0 的首个预发布版本。仓库重构为 pnpm monorepo，源码全面 TypeScript 化，
服务端从 8 份复制代码收敛为 `@twikoojs/common` + 薄适配器，客户端迁移到 Vue 3 + Vite。

> **发布前必读**：本版本包含 12 条对外破坏性变更（BC-1 ~ BC-5、BC-8 ~ BC-14）。
> 升级步骤见文末「升级指引」。

### Breaking changes (summary, EN)

1. **BC-1** Package manager: Yarn 1 → pnpm workspace (developers only).
2. **BC-2** Browser baseline: IE / ES5 dropped; ES2022 output.
3. **BC-3** CloudBase runtime: Node 16.13 no longer supported (use Node 20+, recommended 24.11).
4. **BC-4** Legacy event-name fallback (`comment-get` / `comment-submit` / `comment-like` / `counter-get`) removed.
5. **BC-5** `README.md` is now English; Chinese moved to `README-zh_CN.md`; `README.en.md` deleted.
6. **BC-8** `pnpm-lock.yaml` is now committed (was git-ignored).
7. **BC-9** Client `version.js` removed; version is injected at build time (public `version` value unchanged).
8. **BC-10** Source is ESM; published libraries expose dual ESM + CJS via `exports`.
9. **BC-11** `pushoo` moved into the monorepo and now follows Twikoo's unified version (`0.1.12` → `2.0.0`); axios 0.26 → 1.x, marked 4 → 18. `notice()` / `NoticeOptions` unchanged.
10. **BC-12** `twikoo-func` keeps its name but its content changed: it is now the CloudBase adapter only; shared logic lives in `@twikoojs/common`. A re-export shim stays until 2.2.0.
11. **BC-13** Adapters now depend on `@twikoojs/common`; publishing must be two-phase (common before adapters). No action for end users.
12. **BC-14** CloudBase CLI deployment (`tcb fn deploy`) removed; console deployment only.

### ⚠️ 破坏性变更（BC-1 ~ BC-14 全清单）

| #     | 项                       | 变化                                                                                        | 影响面                                                                | 你需要做什么                                                                  |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| BC-1  | 包管理器                 | Yarn 1 → pnpm workspace                                                                     | 开发者                                                                | 删除旧 `node_modules`，改用 `pnpm install`                                    |
| BC-2  | 浏览器基线               | 放弃 IE / ES5 目标，产物为 ES2022                                                           | 极老浏览器用户                                                        | 使用 Chrome/Edge 90+、Firefox 88+、Safari 14+                                 |
| BC-3  | CloudBase 运行时         | 放弃 Node 16.13 兼容                                                                        | 未升级运行时的 CloudBase 用户                                         | 控制台选择 Node 20+（推荐 **Node 24.11**）                                    |
| BC-4  | 旧函数名 fallback        | 移除服务端侧 `comment-get` / `comment-submit` / `comment-like` / `counter-get` 兼容分支     | 从 0.1.x 直升 2.0 的用户                                              | **先升级到 1.x**（数据与集合结构）再升 2.0                                    |
| BC-5  | README 文件名            | `README.md` 改英文，中文移至 `README-zh_CN.md`，删除 `README.en.md`                         | 引用 `README.en.md` 的外部链接                                        | 更新链接为 `README-zh_CN.md`                                                  |
| BC-6  | ~~`POST_SUBMIT` 语义~~   | **已被 D-4 消除**（2.0 双支持，2.2.0 才移除）                                               | —                                                                     | 无需处理                                                                      |
| BC-7  | ~~`HIDDEN` / `VISIBLE`~~ | **已被 D-4 消除**（同上）                                                                   | —                                                                     | 无需处理                                                                      |
| BC-8  | `pnpm-lock.yaml`         | 从 gitignore 改为入库                                                                       | 无（改进）                                                            | —                                                                             |
| BC-9  | 版本号                   | 移除客户端手工 `version.js`，改为构建注入（对外 `version` 值不变）                          | 无                                                                    | —                                                                             |
| BC-10 | 模块格式                 | 源码 ESM，公共库双格式                                                                      | 直接 `require` 内部文件的用户                                         | 改走包 `exports` 入口                                                         |
| BC-11 | pushoo 版本策略          | 迁入 monorepo、跟随统一版本（`0.1.12` → `2.0.0`）；axios 1.x、marked 18                     | 依赖 `pushoo: ^0.1.x` 的第三方                                        | 手动改为 `"pushoo": "^2.0.0"`；API 与签名不变                                 |
| BC-12 | `twikoo-func` 同名不同义 | 包名不变，内容变为「仅 CloudBase 适配器」，公共逻辑迁往 `@twikoojs/common`                  | ① `require('twikoo-func')` 取公共函数的用法；② 依赖内部路径的部署脚本 | 过渡期转发导出仍可用（含弃用告警），**2.2.0 移除**；请改引 `@twikoojs/common` |
| BC-13 | 发布顺序要求             | 适配器 `dependencies` 统一改为 `@twikoojs/common`，发布必须分批                             | 不涉及使用者（CI 已按两阶段发布实现）                                 | —                                                                             |
| BC-14 | CloudBase 命令行部署     | 移除 `tcb fn deploy` 支持（`login` / `logout` / `deploy` 脚本与 `@cloudbase/cli` 一并删除） | 使用 `tcb fn deploy` 或自定义 CI 脚本的用户                           | 改用**控制台部署**（在线编辑器 + 在线装依赖），函数功能不受影响               |

### 主要变更

#### 仓库与工程化

- 仓库重构为 **pnpm monorepo**（`twikoo2/`，单分支 `main`），8 个发布包统一版本号（仓库内恒为 `0.0.0`，发布时由 CI 从 Release tag 注入）。
- 源码全面 **TypeScript**；ESLint 9 flat + Prettier + Vitest（含覆盖率门禁）+ `env:check`。
- `pnpm-lock.yaml` 入库；CI 拆分为 lint / typecheck / test / build 四个并行门禁 + 基线守卫。

#### 服务端

- 新增 **`@twikoojs/common`**：ports 契约层、pipeline + 26 事件 dispatcher、4 种数据库实现（Mongo / Loki / BlobKV / CloudBase）、capabilities + 惰性 `import()` 重依赖加载、全部 handler/services。
- 8 个服务端适配器重构为**薄封装**（每个目标 < 150 行），对外包名全部不变：
  `twikoo-func` / `twikoo-vercel` / `tkserver` / `twikoo-netlify` / `twikoo-edgeone-makers`（不发布）/ `twikoo-aws-lambda`（不发布）/ `twikoo-deta`（不发布）/ `twikoo-vercel-min`（不发布）。
- 契约测试套件：26 事件共享断言，逐适配器注入自家数据库实现。
- 依赖完整性 CI 检查（按 capabilities 校验 Scope F 依赖声明）。

#### 客户端（`twikoo`）

- Vue 2 → **Vue 3 组合式 API**（`<script setup lang="ts">`）+ Webpack → **Vite**，产物文件名与 UMD 全局名 `twikoo` **不变**：
  `twikoo.min.js`（内联样式）、`twikoo.all.min.js`（内联样式 + 内置云开发 SDK）、
  `twikoo.nocss.js` / `twikoo.all.nocss.js`（不含样式，配合 `twikoo.css`）。
- 移除 **Element UI** 与 **marked fork**：自研 `tk-input` / `tk-button` / `tk-loading` / `tk-icon`（类名全部 `tk-` 前缀），
  marked 改用官方扩展机制（owo 表情扩展 + 公式透传），公式仍由 KaTeX、代码块仍由 Prism 处理。
- 完整保留 1.7.24 的前端功能：评论列表（排序 / 搜索 / 刷新 / 流式加载更多）、单条评论（点赞 / 点踩 / 回复 / 折叠 / 灯箱）、
  提交框（OwO 表情面板 / 图片上传与压缩 / 草稿 / 预览 / Ctrl+Enter）、
  管理面板（登录 / 评论筛选与操作 / 配置读写 / 邮件测试 / 导入 / 导出）。
- 新增 `TwikooError` 八分类错误模型与内联错误卡片（可折叠详情，含 HTTP 状态与 requestId）。
- i18n 一语言一文件（9 种语言 + 英文兜底），非默认语言分片按需加载。

#### 发布工程

- `release.yml`：`release: published` 触发、8 包矩阵、**两阶段发布**（4 + 4）与 `verify-npm` 轮询 gate、
  版本单调性校验、禁止自动创建 Release（D-21）。
- `ci.yml` 全门禁；`docs.yml` 支持 Release 触发同步部署；Docker 多阶段镜像；pkg（Node 24 SEA）作为 Release 附件。

#### 开发与文档

- `pnpm demo` 一键启动（客户端 9820 / tkserver 8080 / demo 页），依赖全部本地化，**完全离线可用**；
  空库自动 seed 11 项测试场景（`url=/demo.html`）。
- README 英文默认 + `README-zh_CN.md`；docs 英文站点补齐至与中文对称，新增语言自动检测。

### 包版本矩阵（2.0.0-beta.1）

| 包                 | 版本         | 说明                             |
| ------------------ | ------------ | -------------------------------- |
| `twikoo`           | 2.0.0-beta.1 | 客户端（UMD）                    |
| `@twikoojs/common` | 2.0.0-beta.1 | 服务端公共库                     |
| `@twikoojs/shared` | 2.0.0-beta.1 | 共享常量与类型                   |
| `twikoo-func`      | 2.0.0-beta.1 | CloudBase 适配器                 |
| `twikoo-vercel`    | 2.0.0-beta.1 | Vercel 适配器                    |
| `tkserver`         | 2.0.0-beta.1 | 自托管服务                       |
| `twikoo-netlify`   | 2.0.0-beta.1 | Netlify 适配器                   |
| `pushoo`           | 2.0.0-beta.1 | 消息推送（版本策略变更见 BC-11） |

### 升级指引

1. **服务端（CloudBase）**：控制台把运行时切到 Node 20+（推荐 24.11）→ 重新粘贴
   `exports.main = require("twikoo-func").main` → 在线装依赖（仅声明 `twikoo-func`）→ 确认函数状态「正常」。
2. **服务端（Vercel / Netlify / 自托管）**：按 docs 的对应平台页面升级到新版本包即可，无需改配置。
3. **客户端（CDN）**：把引用的 `twikoo.min.js` / `twikoo.all.min.js` 版本号改为 `2.0.0-beta.1`；
   若使用 `twikoo.nocss.js`，需同时引入 `twikoo.css`。
4. **0.1.x 用户**：请先升级到 1.x（BC-4：0.1.x 旧事件名兼容分支已移除）。
5. **`pushoo` 使用方**：手动把依赖范围改为 `"pushoo": "^2.0.0"`（BC-11）。

### 已知延后验证项

以下项目需在**首次推送到 GitHub / 首次发布之后**才能验证，已在重构期间登记到
`.omo/evidence/deferred-github-verifications.md`（含精确验证命令与断言）：

- CI 工作流在 GitHub 上的实际执行结果；
- docs 站点部署到 gh-pages 与 `twikoo.js.org` 生效；
- Release 工作流实际触发与 npm 发布（8 包 `@beta` dist-tag）；
- Docker 镜像构建与容器冒烟（本机无 Docker）；
- pkg SEA 可执行产物的生成与运行（需宿主 Node ≥ 25.7），以及 SEA 产物缺失惰性加载重依赖的问题修复验证。

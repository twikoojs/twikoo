# 发布操作手册（Twikoo 2.0）

> 适用范围：`2.0.0-beta.n` 与 `2.0.0` 及以后的版本。
>
> **核心约定（D-21）**：Release 与 tag **由人**在 GitHub 网页创建，CI **只响应**，
> 不提供 `workflow_dispatch`，也不会自动创建 Release/tag。因此本地仓库**不得**预创建 tag。

- 工作流：`.github/workflows/release.yml`（触发：`release: types: [published]`）
- 版本来源：**唯一**取自 Release tag（`v` 前缀会被 strip），仓库内 8 个发布包恒为 `0.0.0`
- dist-tag：勾选「Set as a pre-release」→ `beta`；未勾 → `latest`

## 0. 前置条件（一次性，仓库管理员）

| 项                                            | 要求                                                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub 权限                                   | 仓库 write（创建 Release、上传 pkg 附件）；Actions 可运行                                                                                       |
| `NPM_TOKEN` secret                            | npm **Automation** 类型 PAT，具备 8 个包（含 `@twikoojs/*` scope）的 publish 权限。工作流把它注入 `NODE_AUTH_TOKEN`（`release.yml` 的发布步骤） |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` secrets | Docker Hub 推送 `imaegoo/twikoo`（仅正式版需要）                                                                                                |
| `TEST_*` secrets（可选）                      | 供 `ci.yml` 的 test job 使用；缺失时相关用例 `describe.skip`，不影响发布                                                                        |
| npm 包所有权                                  | 8 个发布包均须已在 npm 上归属同一维护者账号/组织                                                                                                |

## 1. 发布前本地检查（每次发布都必须全绿）

在 `twikoo2/` 根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/check-adapter-deps.mjs     # 适配器依赖完整性（D-2）
pnpm check:no-js                        # 源码无 .js
pnpm check:workflows                    # actionlint + 结构断言
pnpm check:baseline                     # engines / .nvmrc / 8 包 0.0.0
pnpm release:check                      # 8 个发布包 version 必须为 0.0.0
node node_modules/prettier/bin/prettier.cjs --check .
git tag -l                              # 必须为空：不得预创建 tag
git status --porcelain                  # 必须为空：工作区干净
```

发布顺序/版本合法性可**提前本地预演**（需要网络，读 npm registry）：

```bash
node scripts/release-version-check.mjs monotonic 2.0.0-beta.1     # 大于同线已发布最高版本
node scripts/release-version-check.mjs unpublished 2.0.0-beta.1   # 8 包均未发布过该版本
```

> `verify-npm.mjs` 的轮询/超时逻辑可在本地做负路径预演（用一个不存在的版本）：
> `node scripts/verify-npm.mjs 0.0.0-does-not-exist beta 1 2>&1 | tail -3` → 超时后 exit 1。

## 2. 发布 `2.0.0-beta.n`（预发布）

### 步骤 1 — 创建 Release（人操作）

GitHub → Releases → **Draft a new release**：

| 字段                     | 值                                                                         |
| ------------------------ | -------------------------------------------------------------------------- |
| Choose a tag             | 输入 `v2.0.0-beta.1` 并选择 **Create new tag on publish**，目标分支 `main` |
| Release title            | `2.0.0-beta.1`                                                             |
| Description              | 粘贴 `CHANGELOG.md` 中对应小节的要点（BC 清单务必包含）                    |
| **Set as a pre-release** | ✅ **必须勾选**（否则 dist-tag 会变成 `latest`，污染正式版）               |

> 不需要在本地 `git tag` / `git push --tags`：Release 发布会创建 tag。
> 发布前再次确认 `git tag -l` 仍为空。

### 步骤 2 — 观察工作流

Actions → Release 工作流，依次确认：

1. `校验版本（格式 / 基线 / 单调性 / 未发布过）` —— 4 步全绿（含 `version` / `npm_tag=beta` 输出）；
2. `第一批发布`（4 个矩阵项并行，`fail-fast: true`）：
   `@twikoojs/shared` → `@twikoojs/common` → `pushoo` → `twikoo`；
3. `Gate · 第一批在 npm 可见` —— `verify-npm.mjs <version> beta 1` 轮询（600s / 15s）；
4. `第二批发布`（4 个矩阵项）：`twikoo-func` → `twikoo-vercel` → `tkserver` → `twikoo-netlify`；
5. `Gate · 8 个包在 npm 可见` —— `verify-npm.mjs <version> beta 2`；
6. `Docker 镜像` / `SEA 可执行产物` —— **预发布版会被跳过**（`if: !prerelease`），属预期。

任何一步失败：**不要**手动重跑「第二批」绕过 gate——先看日志定位（见第 5 节）。

### 步骤 3 — 发布后核验

```bash
# 8 个包都能在 beta tag 下取到该版本
for p in twikoo @twikoojs/common @twikoojs/shared twikoo-func twikoo-vercel tkserver twikoo-netlify pushoo; do
  echo -n "$p@beta = "; npm view "$p@beta" version
done

# 新版本没有意外覆盖 latest（预发布阶段 latest 应仍是 1.x）
npm view twikoo dist-tags

# 传递依赖自检（模拟真实用户）
mkdir -p /tmp/twikoo-install-check && cd /tmp/twikoo-install-check
npm init -y && npm install twikoo-vercel@2.0.0-beta.1
node -e "require.resolve('@twikoojs/common'); console.log('common resolvable ✓')"
```

补充核验：

- docs 站点：`https://twikoo.js.org`（`docs.yml` 由 Release 触发同步部署）可访问，英文章节齐全；
- 客户端 CDN：`https://cdn.jsdelivr.net/npm/twikoo@2.0.0-beta.1/dist/twikoo.min.js` 可下载，
  `twikoo.min.js` 自带样式、`twikoo.nocss.js` 需配合 `twikoo.css`；
- 真机平台：按 `packages/*/README.md` 的「平台核对清单」与 `.omo/evidence/` 的 B.3 清单回填。

## 3. 发布 `2.0.0`（正式版）

与 beta 流程相同，仅三处差异：

1. Release 勾选框**不勾** pre-release → dist-tag 为 `latest`；
2. `Docker 镜像` 与 `SEA 可执行产物` 两个 job 会执行（需要 Docker Hub secrets）；
3. 发布后确认 `npm view twikoo dist-tags` 的 `latest` 已更新，且 `imaegoo/twikoo:latest` 镜像已推送。

正式版发布前的额外前置检查：

- beta 反馈问题清单已关闭或明确降级并记录；
- `CHANGELOG.md` 的版本号与日期为终稿；
- `git tag -l` 仍为空（tag 由本次 Release 创建）。

## 4. 回滚

### 4.1 npm 包回滚（72 小时窗口）

npm 允许在发布后 **72 小时**内 `unpublish` 未被依赖的版本。窗口内发现问题：

```bash
# ① 先预告警：把已发布的 beta 标记为废弃，避免新用户踩到
for p in twikoo @twikoojs/common @twikoojs/shared twikoo-func twikoo-vercel tkserver twikoo-netlify pushoo; do
  npm deprecate "$p@2.0.0-beta.1" "该版本存在问题，请勿使用，等待 2.0.0-beta.2"
done

# ② 若必须彻底下线（仅在 72h 内、且无第三方依赖该版本时可行）
for p in twikoo @twikoojs/common @twikoojs/shared twikoo-func twikoo-vercel tkserver twikoo-netlify pushoo; do
  npm unpublish "$p@2.0.0-beta.1" --force
done
```

> **注意**
>
> - 超过 72 小时后 `unpublish` 会被 npm 拒绝，只能 `deprecate` + 发新版本；
> - `unpublish` 不可逆，且会破坏已锁定该版本的用户安装；
> - **两阶段发布**下若只发布了第一批就出问题，第二批尚未发布，此时 `tkserver` 等包在 npm 上仍是 1.x，
>   需要优先判断「是否必须先撤回第一批」——因为第二批的适配器依赖 `@twikoojs/common@^<version>`，
>   若撤回 common 而适配器已发布，会导致用户安装失败，此时应**撤回全部已发布批次或全部保留并直接发补丁版本**。

### 4.2 GitHub Release / tag 回滚

1. 删除 Release（Releases → 该 Release → Delete）——**不会**自动删除 tag；
2. 删除 tag：`git push --delete origin v2.0.0-beta.1`（本地 tag 若存在亦一并删除）；
3. 修复合入 `main` 后用**新的**版本号重新发布（避免复用已废弃的版本号；npm 对已 unpublish 的版本号有冷却限制）。

### 4.3 工作流失败后的重试策略

| 失败位置                                    | 处理                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `validate` 失败（版本格式/单调性/未发布过） | 修正 Release tag 后**新建** Release（tag 无法改名，只能删掉重建）                             |
| 第一批部分包失败                            | 修因后点击 **Re-run failed jobs**；已成功的包不会重复发布（`unpublished` 校验会拦住重复版本） |
| `Gate · 第一批` 超时                        | npm 侧可能有延迟；先 `npm view <包>@beta version` 手工确认，再 Re-run failed jobs             |
| 第二批部分包失败                            | 同上；**不要**跳过 gate 手工发布，`verify-batch-2` 是必要门禁                                 |
| `npm publish` 报 `ENEEDAUTH` / `E403`       | 检查 `NPM_TOKEN` secret 是否存在且未过期、是否有 8 个包的 publish 权限                        |

## 5. 常见问题

| 现象                                                        | 原因与处理                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ENEEDAUTH` / `Failed to replace env in config`             | `NPM_TOKEN` secret 缺失或未注入到 `NODE_AUTH_TOKEN`（`release.yml` 发布步骤已显式注入，检查 secret 是否存在） |
| `E403 You do not have permission to publish`                | token 权限不足（需 Automation 类型 PAT）或包归属不在该账号下                                                  |
| `EPUBLISHCONFLICT` / `cannot publish over existing version` | 该版本已存在（`unpublished` 校验未拦住说明是并发操作）→ 换版本号                                              |
| `verify-npm` 超时但 npm 上可见                              | npm registry 缓存延迟，Re-run failed jobs 即可                                                                |
| 预发布却出现 `latest` 被动更新                              | Release 勾选框未勾 pre-release → 删除 Release 与 tag，按 `deprecate` 处理，用 beta 版本号重发                 |
| Docker / pkg job 被 skipped                                 | 预发布版本预期行为（`if: !prerelease`）                                                                       |

## 6. 相关文件

| 文件                                             | 作用                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| `.github/workflows/release.yml`                  | 发布工作流（两阶段 + gate）                    |
| `scripts/release-packages.mjs`                   | 8 个发布包的单一事实来源（名称 / 目录 / 批次） |
| `scripts/release-set-version.mjs`                | 覆写/校验仓库内版本基线（恒 `0.0.0`）          |
| `scripts/release-version-check.mjs`              | 单调性与「未发布过」校验                       |
| `scripts/verify-npm.mjs`                         | npm 可见性轮询 gate                            |
| `CHANGELOG.md`                                   | 版本与破坏性变更记录                           |
| `.omo/evidence/deferred-github-verifications.md` | 首次推送后需补验的 GitHub 侧项目清单           |

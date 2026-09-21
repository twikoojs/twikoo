---
# Twikoo issue 自动分诊（GitHub Agentic Workflows）
#
# 触发：新建 / 重新打开的 issue。能力：设置 issue type、打标签、留一条给维护者的分诊报告。
#
# ── 前置条件 ────────────────────────────────────────────────────────
#   1. 仓库 secret `COPILOT_PROVIDER_BASE_URL`：OpenAI 兼容端点的完整 URL（含 /v1）
#   2. 仓库 secret `COPILOT_PROVIDER_API_KEY` ：端点密钥
#      —— 这两个 secret 名与 env 变量名一一对应，不做映射（它们正是严格模式白名单里的两个）
#   3. 仓库 secret `COPILOT_GITHUB_TOKEN`（可选）：仅在威胁检测步骤报 Copilot 许可 / 403 时补
#   4. 仓库变量 `COPILOT_MODEL`：模型名，当前值 `flash`
#      —— 模型名不在 secret 白名单里，只能取变量或字面量
#   5. 端点域名必须**明文**列在下面的 network.allowed
#      —— URL 走 secret 时 gh-aw 无法自动推导主机名，漏了会导致威胁检测步骤失败
#
# ── 修改后必须重新编译并提交产物 ──────────────────────────────────────
#   gh extension install github/gh-aw
#   pnpm format:md                                        # 先让 AutoCorrect 重排中文
#   gh aw compile .github/workflows/issue-triage.md       # 再编译，否则产物与源不一致
#   git add .github/workflows/issue-triage.md .github/workflows/issue-triage.lock.yml
#
# ── 关于 Copilot 凭据 ────────────────────────────────────────────────
#   推理走下面的 BYOK 自定义端点，不消耗 Copilot 配额，因此**不要**在这里加
#   `permissions: copilot-requests: write`（那会让 BYOK 凭据在推理环节被忽略）。
#   若威胁检测步骤报 Copilot 许可 / 403 错误，再补一个 secret `COPILOT_GITHUB_TOKEN`：
#   必须是**细粒度 PAT**（GitHub App / OAuth 都不支持，`gho_` 开头会在 activation 阶段直接失败），
#   Resource owner 选**个人账号**（不能是组织），权限开 Account permissions → Copilot Requests = Read。

description: |
  对新开或重新打开的 issue 做分诊：评估信息完整度、设置 issue type 与标签、
  检索疑似重复项，并给维护者留一条可直接执行的分诊报告。

on:
  issues:
    types: [opened, reopened]
  reaction: eyes
  # 允许**任何用户**开的 issue 触发分诊。默认值是 admin/maintainer/write —— 那意味着
  # 外部贡献者（仓库权限 read）开的 issue 会在 pre_activation 门禁被静默跳过：整个 run
  # 显示 success，但下游 job 全 skipped，issue 一个标签都拿不到。
  # 社区分诊必须放开这一层；内容层面的防注入仍由 tools.github.min-integrity 负责。
  roles: all

permissions:
  contents: read
  issues: read
  # 默认 toolset 里的 pull_requests 需要这个只读权限，否则编译告警
  pull-requests: read
  # 显式声明「不使用 GitHub Actions 令牌做 Copilot 推理」—— 推理走下面的 BYOK 端点。
  # 不写这行会有一条 info 级提示（不写也能跑）。
  copilot-requests: none

engine:
  id: copilot
  env:
    # secret 名与变量名同名，不做映射 —— 这两个属于严格模式下允许引用
    # ${{ secrets.* }} 的固定白名单（第三个是 COPILOT_PROVIDER_BEARER_TOKEN）
    COPILOT_PROVIDER_BASE_URL: ${{ secrets.COPILOT_PROVIDER_BASE_URL }}
    COPILOT_PROVIDER_API_KEY: ${{ secrets.COPILOT_PROVIDER_API_KEY }}
    # 模型名不在 secret 白名单里，只能取变量或字面量；同样同名，不做映射
    COPILOT_MODEL: ${{ vars.COPILOT_MODEL }}
    COPILOT_PROVIDER_TYPE: openai
    COPILOT_PROVIDER_WIRE_API: completions

# 自建端点上的模型不在 models.dev 定价目录里，而 AWF 的 api-proxy 要用定价做
# AI Credits 成本记账 —— 没有费率时会直接以 400 拒绝请求：
#   Model "flash" has no AI credits pricing and no default pricing is configured.
# 所以必须给一个兜底费率。单位是**每 token 美元**，且必须写普通小数 ——
# 编译器会把 "1e-07" 这类科学计数法字符串解析成 0 并报错（input must be a positive value）。
# 0.0000001 = $0.10/百万 token，0.0000004 = $0.40/百万 token。
# 下面按 Flash 档位估的占位值，请按你端点的实际账单调整。
models:
  default-ai-credits-pricing:
    input: 0.0000001
    output: 0.0000004

tools:
  github:
    # 公开仓库默认自动应用 min-integrity: approved，会把外部贡献者（CONTRIBUTOR /
    # FIRST_TIME_CONTRIBUTOR / NONE）开的 issue 全部过滤掉 —— 即 agent 读不到本该分诊的
    # issue，且不报错。社区分诊场景必须降到 unapproved。
    min-integrity: unapproved

network:
  allowed:
    - defaults
    - ai.imaegoo.com
    # agent 分诊时会去查 npm 包信息（核实依赖是否声明、版本等）。
    # 实测不加会被 firewall 拦下，分诊报告里会多出一条 blocked domain 告警。
    # 用生态标识符 `node`（等价于 registry.npmjs.org 等 npm 相关域名）而不是写死域名，
    # gh-aw 明确建议这么做，可维护性更好。
    - node

safe-outputs:
  add-labels:
    allowed:
      - bug
      - enhancement
      - question
      - support
      - documentation
      - discussion
      - tutorial
      - duplicate
      - invalid
    max: 3
  # 允许纠正错标（例如上一轮误打的 invalid 与正文不符）。白名单与 add-labels 一致，
  # 不会碰 good first issue / help wanted / wontfix / long-term 这些维护者标签。
  remove-labels:
    allowed:
      - bug
      - enhancement
      - question
      - support
      - documentation
      - discussion
      - tutorial
      - duplicate
      - invalid
    max: 3
  add-comment:
    max: 1
  set-issue-type:
    max: 1
  # 想让分诊结论直接把 issue 派给 Copilot coding agent 去开 PR，就取消下面两行注释。
  # 需要付费 Copilot 计划，否则运行时会失败。
  # assign-to-agent:
  #   max: 1

# 实测 agent 步骤耗时 4~10 分钟（取决于 issue 复杂度：需要翻代码 / 关联历史 issue 的
# 会明显更久）。原先的 10 分钟卡在上限边缘，#1116 那次就撞上
# 「The action 'Execute GitHub Copilot CLI' has timed out after 10 minutes」而整个 run 失败。
# 放宽到 20 分钟；单次成本另有 maxAiCredits 护栏，不靠超时兜底。
timeout-minutes: 20
---

# Twikoo Issue 分诊助手

分析 issue #${{ github.event.issue.number }}，让维护者能快速看懂并决定怎么处理。
所有结论必须基于 issue 正文、它的讨论与仓库上下文，**不要臆造缺失的信息**。

## 1. 收集上下文

1. 读 issue 正文与全部评论。
2. 查看仓库现有的标签与 issue type。
3. 在 open 与近期 closed 的 issue 中检索相同症状、相同诉求、相同报错信息或相同组件的问题。
4. 必要时查仓库文档（`docs/`）确认预期行为。

## 2. 评估信息完整度

Twikoo 的 issue 里，**版本与部署方式**是判断问题的前提，缺了基本无法推进：

- **前端版本 + 云函数版本**（二者不一致本身就是常见问题来源，2.0 前后尤其明显）
- **部署方式**：CloudBase / Vercel / Netlify / Docker 私有部署 / Hugging Face / EdgeOne Makers / AWS Lambda 等
- **报错原文**：控制台或云函数日志里的原文，不是「报错了」这种转述
- **复现步骤**，以及**期望行为 vs 实际行为**

信息不足时：

- 只问**推进所必需**的那几个具体问题，不要罗列一长串模板式清单
- **不要**猜 type、标签或解决方案

若明显是垃圾提交、无意义内容或测试贴，打 `invalid` 并简短说明，后续步骤全部跳过。

## 3. 设置 issue type 与标签

### issue type

仓库可用的 type 是 `Bug` / `Feature` / `Task`。未设置时选**唯一最贴切**的一个；
证据不足以判断就**留空**。

### 标签

只从仓库**已存在**的标签里选，且必须有 issue 内容直接支撑：

- `bug`：可复现的缺陷
- `enhancement`：功能建议
- `question`：提问
- `support`：使用求助（含「请适配某某主题」这类请求）
- `documentation` / `tutorial` / `discussion`：文档、教程、讨论
- `duplicate` / `invalid`：见第 4 步

**最多 1 个类型标签，外加 1 个 `duplicate` 或 `invalid`**，拿不准就不打。
标签会触发其他自动化，宁可留空也不要猜。

不要打 `good first issue` / `help wanted` / `wontfix` / `long-term` —— 这些是维护者的判断，
不是分诊结论。

## 4. 判断重复与关联

区分两件事：

- **重复**：高置信度认为另一个 issue 描述的是同一个问题或同一个诉求。打 `duplicate`，
  并在评论里写明 issue 编号。
- **相关**：同一组件或同一上下文，但问题/诉求不同。只在评论里提一句，**不要**打 `duplicate`。

**绝对不要只因为标题用词相似就判重复。** 同一个主题下往往有大量根因不同的问题
（例如一堆「邮件通知不生效」分别由 SMTP 配置、Akismet、邮箱服务商差异，甚至预期行为导致）。
判定前必须读正文。最多列 3 个有用的关联 issue。

## 5. 给出下一步建议

判断这个 issue 是否已经可以动手：

- **可以动手**：需求与验收标准清晰，范围自洽
- **等补充信息**：拿到第 2 步问的具体信息后即可推进
- **需要维护者决策**：涉及产品、架构或跨模块取舍

给**一个**聚焦的下一步，不要写成实现方案。

## 6. 输出

只发**一条**给维护者的评论：

````markdown
## 分诊报告

[两三句话概括问题与建议的处理方式。]

| 评估项 | 结论 | 依据 |
| --- | --- | --- |
| 类型 | [type 或留空] | [简要证据] |
| 可动手性 | [可以动手 / 等补充信息 / 需维护者决策] | [简要证据] |

### 关联 issue

- #[编号] — [重复或相关，附一句理由]

### 下一步

[一个具体动作，或仍缺的那条信息。]
````

没有有用的关联项时省略「关联 issue」小节。信息不完整时，用**具体的追问**替换整张表格。

评论保持客观、简洁、可直接执行。

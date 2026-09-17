#!/usr/bin/env node
/**
 * GitHub Actions 工作流校验（T39/T40 共用）：
 *   ① actionlint（npm 上的 wasm 构建，无需安装 Go）逐文件静态检查；
 *   ② 关键结构断言——把「计划里写死的约束」固化为机器检查，而不是靠人工 review。
 *
 * 用法：node scripts/check-workflows.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLinter } from "actionlint";
import { parse } from "yaml";
import { PUBLISH_PACKAGES } from "./release-packages.mjs";

/** 工作流目录 */
const WORKFLOW_DIR = fileURLToPath(new URL("../.github/workflows", import.meta.url));

/** 收集到的失败项 */
const failures = [];

/**
 * 断言并记录失败。
 * @param condition 条件
 * @param message 失败说明
 */
function expect(condition, message) {
  if (!condition) failures.push(message);
}

/** 读取全部工作流（文件名 → 源码 / 解析结果） */
const workflows = new Map();
for (const file of readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))) {
  const source = readFileSync(`${WORKFLOW_DIR}/${file}`, "utf8");
  workflows.set(file, { source, doc: parse(source) });
}
console.log(`发现 ${workflows.size} 个工作流：${[...workflows.keys()].join(", ")}`);

// ---- ① actionlint ----
// 每个文件新建一个 wasm 实例：actionlint 的 npm 构建在 wasm 内存增长后会持有已
// detach 的 ArrayBuffer，复用同一实例连续 lint 较大文件会抛
// `RangeError: offset is out of bounds`（实测）。
for (const [file, { source }] of workflows) {
  const linter = await createLinter();
  const problems = await linter(source, `.github/workflows/${file}`);
  if (problems.length > 0) {
    for (const p of problems) {
      failures.push(`actionlint ${file}:${p.line}:${p.column} ${p.kind}: ${p.message}`);
    }
  } else {
    console.log(`  ✓ actionlint 通过：${file}`);
  }
}

// ---- ② 结构断言 ----
const release = workflows.get("release.yml");
expect(release !== undefined, "缺少 .github/workflows/release.yml");
if (release) {
  const doc = release.doc;
  const source = release.source;

  /** 触发链：只订阅 release.published，且不得有 workflow_dispatch */
  const releaseTypes = doc?.on?.release?.types ?? [];
  expect(
    JSON.stringify(releaseTypes) === JSON.stringify(["published"]),
    `release.yml 必须且只能订阅 release.types = [published]（当前：${JSON.stringify(releaseTypes)}）`,
  );
  expect(
    doc?.on?.workflow_dispatch === undefined,
    "release.yml 不得包含 workflow_dispatch（D-21）",
  );
  expect(!releaseTypes.includes("prereleased"), "release.yml 不得订阅 prereleased（八坑对策）");
  expect(!releaseTypes.includes("released"), "release.yml 不得订阅 released（八坑对策）");

  /** 矩阵 8 项与 Scope C 一致 */
  const matrixPackages = [];
  for (const job of Object.values(doc?.jobs ?? {})) {
    const include = job?.strategy?.matrix?.include;
    if (Array.isArray(include)) {
      for (const entry of include) if (entry?.package) matrixPackages.push(entry.package);
    }
  }
  const expected = PUBLISH_PACKAGES.map((p) => p.name);
  expect(
    matrixPackages.length === expected.length,
    `发布矩阵应为 ${expected.length} 项，实际 ${matrixPackages.length} 项：${matrixPackages.join(", ")}`,
  );
  for (const name of expected) {
    expect(matrixPackages.includes(name), `发布矩阵缺少包：${name}`);
  }

  /** 两阶段发布 gate */
  const jobs = doc?.jobs ?? {};
  expect(jobs["verify-batch-1"] !== undefined, "缺少第一批 verify gate（verify-batch-1）");
  expect(jobs["verify-batch-2"] !== undefined, "缺少第二批 verify gate（verify-batch-2）");
  const batch2Needs = [].concat(jobs["publish-batch-2"]?.needs ?? []);
  expect(
    batch2Needs.includes("verify-batch-1"),
    "publish-batch-2 必须 needs verify-batch-1（§4.3.2 分批强制）",
  );
  expect(
    [].concat(jobs["publish-docker"]?.needs ?? []).includes("verify-batch-2"),
    "publish-docker 必须 needs verify-batch-2",
  );

  /** 版本一律来自 Release tag */
  expect(
    source.includes("github.event.release.tag_name"),
    "release.yml 必须从 github.event.release.tag_name 取版本",
  );
  expect(
    /TAG:\s*\$\{\{\s*github\.event\.release\.tag_name\s*\}\}/.test(source),
    "release.yml 应把 tag_name 注入 TAG 环境变量后统一 strip /^v/",
  );

  /** 单调性校验步骤存在 */
  expect(
    /release-version-check\.mjs\s+monotonic/.test(source),
    "release.yml 缺少版本单调性校验步骤（release-version-check.mjs monotonic）",
  );
  expect(
    /release-version-check\.mjs\s+unpublished/.test(source),
    "release.yml 缺少「未发布过」校验步骤",
  );
  expect(
    /release-set-version\.mjs\s+--check/.test(source),
    "release.yml 缺少 8 包 0.0.0 基线校验步骤",
  );

  /** 禁止自动创建 Release（只允许往已有 Release 上传产物） */
  expect(
    !/softprops\/action-gh-release/.test(source),
    "release.yml 不得使用 action-gh-release（可能自动创建 Release）",
  );
  expect(!/gh\s+release\s+create/.test(source), "release.yml 不得执行 gh release create");

  /** 发布必须带 provenance 与 dist-tag，且不得吞错（无 || true） */
  expect(source.includes("--provenance"), "npm publish 必须带 --provenance");
  expect(
    !/\|\|\s*true/.test(source),
    "release.yml 不得用 `|| true` 吞掉发布错误（E403 需 fail loudly）",
  );

  /** checkout 版本下限（八坑对策：≥ v6.0.2） */
  for (const m of source.matchAll(/actions\/checkout@v(\d+)/g)) {
    expect(Number(m[1]) >= 6, `actions/checkout 版本过低：@v${m[1]}（要求 ≥ v6）`);
  }
}

const docs = workflows.get("docs.yml");
if (docs) {
  const source = docs.source;
  expect(source.includes("imaegoo/vuepress-deploy@master"), "docs.yml 应保留 vuepress-deploy 部署");
  expect(source.includes("CNAME: twikoo.js.org"), "docs.yml 应保留 CNAME");
  expect(/types:\s*\[published\]/.test(source), "docs.yml 应在 Release 时同步部署");
}

// ---- ③ ci.yml（T40：4 并行门禁 + 2 守卫）----
const ci = workflows.get("ci.yml");
expect(ci !== undefined, "缺少 .github/workflows/ci.yml");
if (ci) {
  const doc = ci.doc;
  const source = ci.source;
  const jobs = doc?.jobs ?? {};

  /** 4 个门禁 job 并行（互不 needs） */
  for (const job of ["lint", "typecheck", "test", "build"]) {
    expect(jobs[job] !== undefined, `ci.yml 缺少门禁 job：${job}`);
    expect(
      [].concat(jobs[job]?.needs ?? []).length === 0,
      `ci.yml 的 ${job} job 应与其他门禁并行（不得声明 needs）`,
    );
  }

  /** test job 注入 §9.4 的 A 类密钥（缺失即空 → 用例 skip） */
  const testEnv = jobs["test"]?.env ?? {};
  const injected = Object.keys(testEnv).filter((k) => k.startsWith("TEST_"));
  expect(
    injected.length >= 14,
    `ci.yml 的 test job 应注入 §9.4 A 类密钥（≥14 个），实际 ${injected.length} 个`,
  );
  for (const key of injected) {
    expect(
      String(testEnv[key]).includes(`secrets.${key}`),
      `ci.yml 的 test job 环境变量 ${key} 应取自 secrets.${key}`,
    );
  }

  /** 基线守卫 job */
  expect(jobs["baseline"] !== undefined, "ci.yml 缺少基线守卫 job（baseline）");
  expect(/check-baseline\.mjs/.test(source), "ci.yml 的基线守卫应执行 scripts/check-baseline.mjs");

  /** AGENTS.md 滞后警告：只在 PR 触发，且不阻塞 */
  const staleness = jobs["agents-staleness"];
  expect(staleness !== undefined, "ci.yml 缺少 AGENTS.md 滞后警告 job（agents-staleness）");
  expect(
    String(staleness?.if ?? "").includes("pull_request"),
    "agents-staleness job 应仅在 pull_request 事件触发",
  );
  expect(
    /check-agents-staleness\.mjs/.test(source),
    "ci.yml 的警告 job 应执行 scripts/check-agents-staleness.mjs",
  );

  /** 全仓门禁命令齐备 */
  for (const cmd of ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build"]) {
    expect(source.includes(cmd), `ci.yml 缺少门禁命令：${cmd}`);
  }
}

// ---- 汇总 ----
if (failures.length > 0) {
  console.error(`\n✗ 工作流校验失败（${failures.length} 项）：`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\n✓ 全部工作流校验通过（actionlint + 结构断言）");

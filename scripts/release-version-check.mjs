#!/usr/bin/env node
/**
 * 发布前版本校验：**单调性**与**未发布过**。
 *
 * 用法：
 *   node scripts/release-version-check.mjs monotonic 2.0.0-beta.2
 *   node scripts/release-version-check.mjs unpublished 2.0.0-beta.2
 *
 * - `monotonic`：新版本必须**大于** npm 上已发布的「同 major.minor」最高版本
 *   （防手误把序号写小，例如 beta.1 之后再发 beta.1）；
 * - `unpublished`：8 个包都不能已经存在该版本（防重复发布导致 npm 403 半途失败）。
 *
 * 需要网络（npm registry）；失败一律 exit 1（fail loudly，不静默跳过）。
 */
import { execFileSync } from "node:child_process";
import { compareVersions, majorMinorOf, PUBLISH_PACKAGES } from "./release-packages.mjs";

/** npm registry（CI 固定官方源） */
const REGISTRY = process.env.NPM_REGISTRY ?? "https://registry.npmjs.org";

/**
 * Windows 下 npm 是 `npm.cmd`，`execFileSync("npm", …)` 会直接 ENOENT 被 catch 吞掉，
 * 导致「包从未发布过」的误判（本地发布预演失效）。故在 Windows 上经 shell 执行。
 */
const NPM_EXEC_OPTIONS = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
};

/**
 * 查询某包在 npm 上的全部版本。
 * @param name 包名
 * @returns 版本数组（包不存在返回空数组）
 */
function publishedVersions(name) {
  try {
    const out = execFileSync(
      "npm",
      ["view", name, "versions", "--json", `--registry=${REGISTRY}`],
      NPM_EXEC_OPTIONS,
    );
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    /** 包从未发布过 / 网络失败：按「无已发布版本」处理，后续 unpublished 校验仍会兜底 */
    return [];
  }
}

/**
 * 查询某包某版本是否已发布。
 * @param name 包名
 * @param version 版本号
 * @returns 已发布返回 true
 */
function isPublished(name, version) {
  try {
    const out = execFileSync(
      "npm",
      ["view", `${name}@${version}`, "version", `--registry=${REGISTRY}`],
      NPM_EXEC_OPTIONS,
    );
    return out.trim() === version;
  } catch {
    return false;
  }
}

const [, , mode, version] = process.argv;
if (!mode || !version) {
  console.error("usage: node scripts/release-version-check.mjs <monotonic|unpublished> <version>");
  process.exit(1);
}

if (mode === "monotonic") {
  const target = majorMinorOf(version);
  const problems = [];
  for (const { name } of PUBLISH_PACKAGES) {
    const sameLine = publishedVersions(name).filter((v) => majorMinorOf(v) === target);
    if (sameLine.length === 0) continue;
    const highest = sameLine.sort(compareVersions).at(-1);
    if (compareVersions(version, highest) <= 0) {
      problems.push(`${name}: 待发布 ${version} ≤ 已发布的最高同线版本 ${highest}`);
    } else {
      console.log(`  ✓ ${name}: ${version} > ${highest}`);
    }
  }
  if (problems.length > 0) {
    console.error("✗ 版本单调性校验失败（疑似手误把序号写小）：");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log(`✓ 单调性校验通过（major.minor = ${target}）`);
  process.exit(0);
}

if (mode === "unpublished") {
  const duplicated = PUBLISH_PACKAGES.filter(({ name }) => isPublished(name, version)).map(
    ({ name }) => name,
  );
  if (duplicated.length > 0) {
    console.error(`✗ 以下包已存在版本 ${version}，不能重复发布：`);
    for (const name of duplicated) console.error("  - " + name);
    process.exit(1);
  }
  console.log(`✓ 未发布过校验通过：8 个包均无 ${version}`);
  process.exit(0);
}

console.error(`未知模式：${mode}（可选 monotonic / unpublished）`);
process.exit(1);

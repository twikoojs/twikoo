#!/usr/bin/env node
/**
 * 发布版本号处理（「版本一致性校验」+ 覆写）。
 *
 * 用法：
 *   node scripts/release-set-version.mjs --check        # 只校验基线（8 包全 0.0.0）
 *   node scripts/release-set-version.mjs 2.0.0-beta.1   # 校验基线后把版本覆写到 8 个包
 *
 * 设计要点：
 * - 版本号**不进入 git**：仓库内恒为 `0.0.0`，CI 覆写后直接发布；
 * - 覆写前强制校验基线，防止「上一次发布残留的版本号」被误发布；
 * - 版本格式与 release tag 一致（`x.y.z` 或 `x.y.z-beta.n`）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BASELINE_VERSION, PUBLISH_PACKAGES } from "./release-packages.mjs";

/** 允许的版本格式（与 release.yml 的 tag 校验一致） */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$/;

/**
 * 读取发布包的 package.json。
 * @param dir 包目录（仓库根相对）
 * @returns 解析后的 package.json 与文件路径
 */
function readPackage(dir) {
  const path = fileURLToPath(new URL(`../${dir}/package.json`, import.meta.url));
  return { path, pkg: JSON.parse(readFileSync(path, "utf8")) };
}

/**
 * 校验 8 个发布包 version 均为基线值。
 * @returns 违规清单（为空表示通过）
 */
function checkBaseline() {
  const offenders = [];
  for (const { name, dir } of PUBLISH_PACKAGES) {
    const { pkg } = readPackage(dir);
    if (pkg.name !== name) offenders.push(`${dir}: 包名 ${pkg.name} ≠ 期望 ${name}`);
    if (pkg.version !== BASELINE_VERSION) {
      offenders.push(`${name} (${dir}): version = ${pkg.version}，应为 ${BASELINE_VERSION}`);
    }
  }
  return offenders;
}

const [, , arg] = process.argv;
const checkOnly = arg === "--check" || arg === undefined;

/** 1. 基线校验（两种模式都做） */
const offenders = checkBaseline();
if (offenders.length > 0) {
  console.error("✗ 发布基线校验失败——以下发布包 version 不是 " + BASELINE_VERSION + "：");
  for (const o of offenders) console.error("  - " + o);
  console.error("  版本号由 CI 从 Release tag 注入，请勿手工修改。");
  process.exit(1);
}
console.log(`✓ 基线校验通过：${PUBLISH_PACKAGES.length} 个发布包 version 均为 ${BASELINE_VERSION}`);

if (checkOnly) {
  if (arg === undefined) console.log("（未提供版本号：仅执行 --check 校验）");
  process.exit(0);
}

/** 2. 版本格式校验 */
if (!VERSION_PATTERN.test(arg)) {
  console.error(`✗ 版本号格式非法：${arg}（期望 x.y.z 或 x.y.z-beta.n）`);
  process.exit(1);
}

/** 3. 覆写 8 个包 */
for (const { name, dir } of PUBLISH_PACKAGES) {
  const { path, pkg } = readPackage(dir);
  pkg.version = arg;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  ✓ ${name} → ${arg}`);
}
console.log(`✓ 已把 ${PUBLISH_PACKAGES.length} 个发布包的 version 覆写为 ${arg}`);

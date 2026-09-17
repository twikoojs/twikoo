#!/usr/bin/env node
/**
 * 基线守卫（T40 / §4.4）：把「阶段 0 约定的三条基线」固化为机器检查。
 *
 *   ① 根 `package.json` 的 `engines.node` == ">=20"
 *   ② `.nvmrc` == "24"
 *   ③ 8 个发布包 `version` 全为 `0.0.0`（版本由 CI 从 Release tag 注入）
 *
 * 用法：node scripts/check-baseline.mjs（CI 的 baseline job 与本地均使用）
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BASELINE_VERSION, PUBLISH_PACKAGES } from "./release-packages.mjs";

/** 期望的 engines.node */
const EXPECTED_ENGINES_NODE = ">=20";

/** 期望的 .nvmrc */
const EXPECTED_NVMRC = "24";

/** 断言结果 */
const failures = [];

/**
 * 断言并记录失败。
 * @param condition 条件
 * @param message 失败说明
 */
function expect(condition, message) {
  if (condition) {
    console.log("  ✓ " + message.replace(/^✗ /, ""));
  } else {
    failures.push(message);
  }
}

/** ① engines.node */
const rootPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
);
expect(
  rootPkg.engines?.node === EXPECTED_ENGINES_NODE,
  `engines.node 应为 "${EXPECTED_ENGINES_NODE}"，实际 "${rootPkg.engines?.node}"`,
);

/** ② .nvmrc */
const nvmrc = readFileSync(fileURLToPath(new URL("../.nvmrc", import.meta.url)), "utf8").trim();
expect(nvmrc === EXPECTED_NVMRC, `.nvmrc 应为 "${EXPECTED_NVMRC}"，实际 "${nvmrc}"`);

/** ③ 8 个发布包 version */
const versionOffenders = [];
for (const { name, dir } of PUBLISH_PACKAGES) {
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../${dir}/package.json`, import.meta.url)), "utf8"),
  );
  if (pkg.version !== BASELINE_VERSION) versionOffenders.push(`${name}=${pkg.version}`);
}
expect(
  versionOffenders.length === 0,
  `${PUBLISH_PACKAGES.length} 个发布包 version 应全为 ${BASELINE_VERSION}，违规：${versionOffenders.join(", ") || "无"}`,
);

if (failures.length > 0) {
  console.error(`\n✗ 基线守卫失败（${failures.length} 条）：`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\n✓ 基线守卫通过（engines.node / .nvmrc / 8 包 version）");

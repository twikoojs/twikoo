#!/usr/bin/env node
/**
 * npm 可见性轮询 gate（§4.3.2：作为第二批发布的前置条件）。
 *
 * 用法：
 *   node scripts/verify-npm.mjs <version> <npm-tag> <batch>
 *     batch = 1（校验第一批 4 个包）| 2（校验全部 8 个包）
 *
 * 轮询参数：超时 600s、间隔 15s（与 1.x verify-npm 一致）。
 * 任一包在超时后仍不可见 → exit 1（fail loudly）。
 */
import { execFileSync } from "node:child_process";
import { packagesOfBatch, PUBLISH_PACKAGES } from "./release-packages.mjs";

/** 轮询总超时（秒） */
const TIMEOUT = parseInt(process.env.VERIFY_TIMEOUT ?? "", 10) || 600;

/** 轮询间隔（秒） */
const INTERVAL = parseInt(process.env.VERIFY_INTERVAL ?? "", 10) || 15;

/** npm registry（CI 固定官方源） */
const REGISTRY = process.env.NPM_REGISTRY ?? "https://registry.npmjs.org";

/**
 * Windows 下 npm 是 `npm.cmd`，`execFileSync("npm", …)` 会 ENOENT 导致所有包恒判为
 * 「不可见」（gate 退化为必然超时）。故在 Windows 上经 shell 执行。
 */
const NPM_EXEC_OPTIONS = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
};

/**
 * 查询包在指定 dist-tag 下的版本。
 * @param name 包名
 * @param tag dist-tag（beta / latest）
 * @returns 版本号（查不到返回空串）
 */
function versionOfTag(name, tag) {
  try {
    return execFileSync(
      "npm",
      ["view", `${name}@${tag}`, "version", `--registry=${REGISTRY}`],
      NPM_EXEC_OPTIONS,
    ).trim();
  } catch {
    return "";
  }
}

/**
 * 休眠。
 * @param seconds 秒数
 * @returns Promise
 */
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

const [, , version, tag, batch] = process.argv;
if (!version || !tag || !batch) {
  console.error("usage: node scripts/verify-npm.mjs <version> <npm-tag> <1|2>");
  process.exit(1);
}

/** 校验范围：batch 2 覆盖全部 8 个包（含第一批） */
const targets = batch === "2" ? PUBLISH_PACKAGES : packagesOfBatch(Number(batch));
console.log(
  `等待 ${targets.length} 个包在 npm 上可见（version=${version}, tag=${tag}, 超时 ${TIMEOUT}s）…`,
);

let elapsed = 0;
while (elapsed < TIMEOUT) {
  const missing = targets.filter(({ name }) => versionOfTag(name, tag) !== version);
  if (missing.length === 0) {
    console.log(`✓ 全部 ${targets.length} 个包已可见（${tag} = ${version}）`);
    process.exit(0);
  }
  console.log(
    `  ⏳ 待可见：${missing.map((m) => m.name).join(", ")}（剩余 ${TIMEOUT - elapsed}s）`,
  );
  await sleep(INTERVAL);
  elapsed += INTERVAL;
}

console.error(`✗ 超时 ${TIMEOUT}s 后仍有包不可见：${version} / tag=${tag}`);
process.exit(1);

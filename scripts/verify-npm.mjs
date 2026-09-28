#!/usr/bin/env node
/**
 * npm 可见性轮询 gate（作为发布后、Docker / SEA 收尾步骤的前置条件）。
 *
 * 用法：
 *   node scripts/verify-npm.mjs <version> <npm-tag>
 *
 * 单阶段发布：一次性校验全部 9 个发布包（不再有批次参数）。
 *
 * 轮询参数：超时 1800s（30 分钟）、间隔 15s。
 * 任一包在超时后仍不可见 → exit 1（fail loudly）。
 *
 * 为什么是 30 分钟：发布成功后 npm 还可能出现「版本存在但不可见」的中间态 ——
 * 自动审查（包页显示 `Validating`，即在跑恶意代码扫描）或暂存队列。
 * 2026-09-28 的 2.0.10 就踩在这上面：`@twikoojs/edgeone-makers` 是个 7.4 MB
 * 单文件包（内联了完整实现），扫描耗时远超其余 9 个包，原 600s 超时先到，
 * gate 判失败 → Docker / SEA / 文档站后端重建三个收尾 job 全被跳过，
 * 而 npm 侧随后才把版本放出来。
 *
 * 超时按**墙钟**计（早先用「累计 sleep 秒数」计数，每轮还要跑 N 次 `npm view`，
 * 实际等待时长会比配置值长一半左右，配置值与体感对不上）。
 */
import { execFileSync } from "node:child_process";
import { PUBLISH_PACKAGES } from "./release-packages.mjs";

/** 轮询总超时（秒，墙钟） */
const TIMEOUT = parseInt(process.env.VERIFY_TIMEOUT ?? "", 10) || 1800;

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

const [, , version, tag] = process.argv;
if (!version || !tag) {
  console.error("usage: node scripts/verify-npm.mjs <version> <npm-tag>");
  process.exit(1);
}

/** 校验范围：全部 9 个发布包 */
const targets = PUBLISH_PACKAGES;
console.log(
  `等待 ${targets.length} 个包在 npm 上可见（version=${version}, tag=${tag}, 超时 ${TIMEOUT}s）…`,
);

/** 墙钟截止时刻 */
const deadline = Date.now() + TIMEOUT * 1000;
while (Date.now() < deadline) {
  const missing = targets.filter(({ name }) => versionOfTag(name, tag) !== version);
  if (missing.length === 0) {
    console.log(`✓ 全部 ${targets.length} 个包已可见（${tag} = ${version}）`);
    process.exit(0);
  }
  const remain = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  console.log(`  ⏳ 待可见：${missing.map((m) => m.name).join(", ")}（剩余 ${remain}s）`);
  await sleep(INTERVAL);
}

console.error(`✗ 超时 ${TIMEOUT}s 后仍有包不可见：${version} / tag=${tag}`);
process.exit(1);

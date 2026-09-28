#!/usr/bin/env node
/**
 * npm 可见性轮询 gate（作为发布后、Docker / SEA 收尾步骤的前置条件）。
 *
 * 用法：
 *   node scripts/verify-npm.mjs <version> <npm-tag>
 *
 * 单阶段发布：一次性校验全部 9 个发布包（不再有批次参数）。
 *
 * 轮询参数：超时 3600s（1 小时）、间隔 15s。
 * 任一包在超时后仍不可见 → exit 1（fail loudly）。
 *
 * 为什么是 1 小时：发布成功后 npm 还可能出现「版本存在但不可见」的中间态 ——
 * 自动审查（包页显示 `Validating`，即在跑恶意代码扫描）或暂存队列；
 * 审查耗时不可控，且它跑完版本就会自动放出来，等待是**唯一**能救回收尾步骤的办法。
 * 2026-09-28 的 2.0.10 就踩在这上面：`@twikoojs/edgeone-makers` 是个 7.4 MB
 * 单文件包（内联了完整实现），原 600s 超时先到 → gate 判失败 →
 * Docker / SEA / 文档站后端重建三个收尾 job 全被跳过；而该版本在发版后 30 分钟
 * 仍停在 `Validating`，所以超时定到 1 小时。
 *
 * 超时按**墙钟**计（早先用「累计 sleep 秒数」计数，每轮还要跑 N 次 `npm view`，
 * 实际等待时长会比配置值长一半左右，配置值与体感对不上）。
 */
import { execFileSync } from "node:child_process";
import { PUBLISH_PACKAGES } from "./release-packages.mjs";

/** 轮询总超时（秒，墙钟） */
const TIMEOUT = parseInt(process.env.VERIFY_TIMEOUT ?? "", 10) || 3600;

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

/**
 * 秒数格式化为 `Xm00s` / `Xs`。
 * 要盯一小时的等待，日志里得能一眼看出已经等了多久。
 * @param seconds 秒数
 * @returns 可读时长
 */
function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

const [, , version, tag] = process.argv;
if (!version || !tag) {
  console.error("usage: node scripts/verify-npm.mjs <version> <npm-tag>");
  process.exit(1);
}

/** 校验范围：全部 9 个发布包 */
const targets = PUBLISH_PACKAGES;
console.log(
  `等待 ${targets.length} 个包在 npm 上可见（version=${version}, tag=${tag}, 超时 ${fmt(TIMEOUT)}）…`,
);

/** 墙钟起点与截止时刻 */
const startedAt = Date.now();
const deadline = startedAt + TIMEOUT * 1000;
while (Date.now() < deadline) {
  const missing = targets.filter(({ name }) => versionOfTag(name, tag) !== version);
  if (missing.length === 0) {
    console.log(
      `✓ 全部 ${targets.length} 个包已可见（${tag} = ${version}，耗时 ${fmt((Date.now() - startedAt) / 1000)}）`,
    );
    process.exit(0);
  }
  const elapsed = (Date.now() - startedAt) / 1000;
  const remain = (deadline - Date.now()) / 1000;
  console.log(
    `  ⏳ 已等 ${fmt(elapsed)} / 剩余 ${fmt(remain)}，待可见：${missing.map((m) => m.name).join(", ")}`,
  );
  await sleep(INTERVAL);
}

console.error(`✗ 超时 ${fmt(TIMEOUT)} 后仍有包不可见：${version} / tag=${tag}`);
process.exit(1);

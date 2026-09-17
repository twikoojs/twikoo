#!/usr/bin/env node
/**
 * AGENTS.md 滞后警告（T40 / §12.1）：改动了「规则相关文件」却没有同步改 `AGENTS.md` 时，
 * 输出 GitHub Actions 的 `::warning::` 注解——**只警告、不失败**（非阻塞）。
 *
 * 用法：
 *   node scripts/check-agents-staleness.mjs --base <base-sha>   # CI（PR）
 *   node scripts/check-agents-staleness.mjs --files a,b,c       # 本地/测试注入文件清单
 *
 * 设计取舍：AGENTS.md 是给 agent 看的开发指引，滞后会误导后续自动化，但它本身
 * 不影响构建与运行，故按计划要求只警告不拦截。
 */
import { execFileSync } from "node:child_process";

/** 触发「AGENTS.md 可能滞后」的规则相关文件（前缀匹配） */
const RULE_PATHS = [
  ".github/workflows/",
  "scripts/check-",
  "scripts/release-",
  "scripts/verify-npm",
  "eslint.config.js",
  "vitest.config.ts",
  "tsconfig.base.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  ".env.example",
];

/** 文档本身（改了它就不算滞后） */
const DOC_PATH = "AGENTS.md";

/**
 * 取变更文件清单。
 * @returns 文件路径数组
 */
function changedFiles() {
  const argv = process.argv.slice(2);
  const filesFlag = argv.indexOf("--files");
  if (filesFlag !== -1) {
    return (argv[filesFlag + 1] ?? "").split(",").filter(Boolean);
  }
  const baseFlag = argv.indexOf("--base");
  const base = baseFlag !== -1 ? argv[baseFlag + 1] : "HEAD~1";
  try {
    return execFileSync("git", ["diff", "--name-only", `${base}`, "HEAD"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

const files = changedFiles();
const touchedRules = files.filter((f) => RULE_PATHS.some((p) => f.startsWith(p)));
const touchedDoc = files.includes(DOC_PATH);

console.log(`变更文件 ${files.length} 个，其中规则相关 ${touchedRules.length} 个。`);
if (touchedRules.length > 0 && !touchedDoc) {
  const list = touchedRules.join(", ");
  console.log(
    `::warning title=AGENTS.md 可能滞后::本次改动涉及规则相关文件（${list}）但未同步更新 ${DOC_PATH}，` +
      `请确认其中的命令、目录结构、能力矩阵、依赖规则是否仍与实现一致（本警告不阻塞构建）。`,
  );
  process.exit(0);
}
console.log("✓ 无需警告：未触及规则相关文件，或已同步更新 AGENTS.md。");

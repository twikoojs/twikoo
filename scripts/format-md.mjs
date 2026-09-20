#!/usr/bin/env node
/**
 * 用 AutoCorrect 检查 / 格式化仓库里的 **markdown**（中文排版：CJK 与拉丁字符、数字之间的空格等）。
 *
 * 用法：
 *   node scripts/format-md.mjs          # 只检查（有差异时打印并 exit 1）
 *   node scripts/format-md.mjs --fix    # 直接改写文件
 *
 * 为什么不用 `autocorrect` CLI 直接扫仓库：AutoCorrect 默认还会处理 `.ts` / `.js`，会把源码注释与
 * **字符串字面量**里的 `: ` 改成 `：`（例如运行时报错的文案 `Chevereto 上传失败: …`），那是改行为、
 * 不是排版。所以这里只收集 `*.md`，并用 `formatFor(text, path)` 走 markdown 规则。
 *
 * 配置见 `.autocorrectrc`（本仓库关闭拼写检查）。prettier 已完全忽略 `*.md`（见 `.prettierignore`），
 * markdown 的格式由本脚本负责。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatFor, lintFor, loadConfig } from "autocorrect-node";

/** 仓库根（本文件位于 scripts/） */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** 不进入的目录：构建产物、依赖、本地数据 */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "cache",
  "coverage",
  "build",
  "pack-test",
  "data",
  ".vendor",
]);

/** 是否 fix 模式（否则只检查） */
const FIX = process.argv.includes("--fix");

/**
 * 收集仓库里的 markdown 文件。
 * @param dir 起始目录
 * @returns md 文件绝对路径列表
 */
function collectMarkdown(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...collectMarkdown(full));
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

/** 载入 `.autocorrectrc`（存在时显式载入，避免依赖进程工作目录） */
const configPath = join(ROOT, ".autocorrectrc");
if (existsSync(configPath)) loadConfig(readFileSync(configPath, "utf8"));

const files = collectMarkdown(ROOT).sort();
/** 有差异的文件数 */
let changedFiles = 0;
/** 差异总行数（检查模式） */
let changedLines = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  if (FIX) {
    const fixed = formatFor(text, file);
    if (fixed !== text) {
      writeFileSync(file, fixed);
      changedFiles++;
      console.log(`已格式化 ${rel}`);
    }
    continue;
  }
  const result = lintFor(text, file);
  if (result.lines.length > 0) {
    changedFiles++;
    changedLines += result.lines.length;
    console.log(`\n${rel}`);
    for (const line of result.lines) {
      console.log(`  ${line.l}:${line.c}  ${line.old}  →  ${line.new}`);
    }
  }
}

if (FIX) {
  console.log(`\n已格式化 ${changedFiles} / ${files.length} 个 markdown 文件`);
} else if (changedFiles > 0) {
  console.log(
    `\n${changedFiles} / ${files.length} 个 markdown 文件需要排版（共 ${changedLines} 处）。` +
      `\n运行 \`pnpm format:md\` 直接修复。`,
  );
  process.exit(1);
} else {
  console.log(`✓ ${files.length} 个 markdown 文件排版均符合 AutoCorrect`);
}

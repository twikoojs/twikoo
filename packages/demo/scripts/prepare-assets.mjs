#!/usr/bin/env node
/**
 * demo 依赖本地化。
 *
 * 把 `bulma` 与 `katex` 从本地 npm 依赖（`packages/demo` 的 devDependencies）
 * 复制到 `packages/demo/.vendor/`，由 Vite 的 publicDir 直供根路径，
 * 使 `pnpm demo` 在**完全离线**环境下可用（页面不引用任何 CDN）。
 *
 * 幂等：目标文件齐全且非空时跳过复制；`--force` 强制重拷。
 * 由 `packages/demo` 的 `dev` 脚本在启动 Vite 前调用，也由单测直接调用。
 */
import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** demo 包目录（本脚本位于 packages/demo/scripts/） */
const DEMO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
/** vendor 资产落点（与 packages/demo/src/index.ts 的 VENDOR_DIR_NAME 保持一致） */
const VENDOR_DIR = join(DEMO_ROOT, ".vendor");
/** 以本包为基准解析依赖（pnpm isolated 链接模式下必须从声明处解析） */
const require = createRequire(import.meta.url);

/**
 * 单文件资产：`node_modules` 内源路径 → vendor 内目标相对路径。
 * 注意：源路径随 bulma/katex 大版本可能变动，升级后应先跑一次本脚本 + demo 测试确认
 * 四类资产（bulma.min.css / katex.min.css / katex.min.js / auto-render.min.js）仍在原位。
 */
const FILE_ASSETS = [
  { pkg: "bulma", from: "css/bulma.min.css", to: "bulma/bulma.min.css" },
  { pkg: "katex", from: "dist/katex.min.css", to: "katex/katex.min.css" },
  { pkg: "katex", from: "dist/katex.min.js", to: "katex/katex.min.js" },
  { pkg: "katex", from: "dist/contrib/auto-render.min.js", to: "katex/auto-render.min.js" },
];

/**
 * 目录资产：katex.min.css 以相对路径 `fonts/...` 引用字体，必须同层复制，
 * 否则离线环境下公式字体 404（回退到系统字体，视觉回归）。
 */
const DIR_ASSETS = [{ pkg: "katex", from: "dist/fonts", to: "katex/fonts" }];

/**
 * 解析依赖包根目录（pnpm isolated 链接下按声明处解析，不用硬编码 node_modules 路径）。
 * @param {string} pkg 包名
 * @returns {string} 包根目录绝对路径
 */
function resolvePackageDir(pkg) {
  return dirname(require.resolve(`${pkg}/package.json`));
}

/**
 * 判断单个目标文件是否已就绪（存在且非空）。
 * @param {string} target 目标绝对路径
 * @returns {boolean} 就绪为 true
 */
function isReady(target) {
  return existsSync(target) && statSync(target).size > 0;
}

/**
 * 执行本地化复制（幂等；缺失或 `--force` 时复制）。
 * @param {{ force?: boolean }} [options] 选项：force 强制重拷
 * @returns {{ copied: string[], skipped: number }} 复制清单与跳过计数
 */
export function prepareAssets(options = {}) {
  const force = options.force === true;
  const copied = [];
  let skipped = 0;

  for (const asset of FILE_ASSETS) {
    const source = join(resolvePackageDir(asset.pkg), asset.from);
    const target = join(VENDOR_DIR, asset.to);
    if (!force && isReady(target)) {
      skipped += 1;
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target);
    copied.push(asset.to);
  }

  for (const asset of DIR_ASSETS) {
    const source = join(resolvePackageDir(asset.pkg), asset.from);
    const target = join(VENDOR_DIR, asset.to);
    if (!force && existsSync(target) && statSync(target).isDirectory()) {
      skipped += 1;
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
    copied.push(asset.to + "/");
  }

  return { copied, skipped };
}

/** 直接执行时（非被 import）跑一次本地化并打印结果。 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  const { copied, skipped } = prepareAssets({ force });
  console.log(
    `[twikoo-demo] 本地化资产就绪：新复制 ${copied.length} 项，已存在跳过 ${skipped} 项` +
      (copied.length > 0 ? `（${copied.join(", ")}）` : "") +
      `\n[twikoo-demo] vendor 目录：${VENDOR_DIR}`,
  );
}

#!/usr/bin/env node
/**
 * T8 规则二守卫：禁止在 packages 各包的 src 目录（含子目录）下新增
 * .js / .mjs / .cjs 源码文件。
 *
 * 背景：2.0 重写模式全量 TypeScript 化，源码目录不允许再出现 JavaScript 文件，
 * 防止回退到 1.x 的 .js 形态。T40 将把本脚本接入 CI 强制执行；
 * 本地可用 `pnpm run check:no-js` 随时自查。
 *
 * 白名单用法：确需保留的 .js 文件，把「仓库根相对 POSIX 路径」加入下方
 * WHITELIST 数组（当前为空数组——重写模式下零存量 .js）。示例：
 *   const WHITELIST = ["packages/demo/src/legacy.cjs"];
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** 白名单：相对仓库根的 POSIX 风格路径，当前为空——零存量（重写模式）。 */
const WHITELIST = [];

/** 禁止出现的源码扩展名。 */
const BANNED_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

const packagesDir = fileURLToPath(new URL("../packages", import.meta.url));

/** 违规文件清单（仓库根相对 POSIX 路径）。 */
const offenders = [];
/** 已扫描的源码文件计数。 */
let scanned = 0;

for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const srcDir = join(packagesDir, pkg.name, "src");
  let entries;
  try {
    entries = readdirSync(srcDir, { recursive: true, withFileTypes: true });
  } catch {
    continue; // 该包没有 src 目录，跳过
  }
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    scanned += 1;
    const relPath = join(
      "packages",
      pkg.name,
      "src",
      entry.parentPath.slice(srcDir.length),
      entry.name,
    )
      .split(sep)
      .join("/");
    const dot = entry.name.lastIndexOf(".");
    const ext = dot === -1 ? "" : entry.name.slice(dot);
    if (BANNED_EXTENSIONS.has(ext) && !WHITELIST.includes(relPath)) {
      offenders.push(relPath);
    }
  }
}

if (offenders.length > 0) {
  console.error("check:no-js 失败——packages 各包 src 目录下发现 JavaScript 源码文件：");
  for (const file of offenders) console.error("  x " + file);
  console.error(
    "共 " +
      offenders.length +
      " 个。源码一律使用 TypeScript；确需保留的文件请把路径加入 scripts/check-no-js-sources.mjs 的 WHITELIST。",
  );
  process.exit(1);
}

console.log(
  "check:no-js 通过：已扫描 packages 各包 src 目录共 " +
    scanned +
    " 个文件，未发现 .js/.mjs/.cjs 源码。",
);

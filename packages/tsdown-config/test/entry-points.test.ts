/**
 * 公开包「入口字段 ↔ 构建产物」一致性测试。
 *
 * **背景（#1194）**：`pushoo@2.0.9` 的 `main` 与 `exports["."].require` 指向
 * `./dist/index.cjs`，而实际产物是 `dist/index.js`（CJS）——`require("pushoo")` 必现
 * `Cannot find module`，且从 `2.0.0-beta.1` 起每个 2.x 版本都如此，没有任何门禁发现它。
 * 根因是入口字段与 `outExtensions` 的产物扩展名契约不符：**非 `type: module` 的包，
 * CJS 侧固定输出 `.js`**（`.cjs` 只属于 `type: module` 的包，用于与 ESM 侧 `.mjs` 区分）。
 *
 * **三条判据**（互补，缺一不可）：
 *
 * 1. **扩展名契约**：`main` / `module` / `types` / `exports.*` / `bin` 的扩展名必须属于该包
 *    模块体系允许的产物扩展名集合 —— 非 `type: module` 的包出现 `.cjs` / `.d.cts` 即失败。
 *    该判据**不需要构建**，任何环境下都能拦住「把 `.js` 写成 `.cjs`」这类契约错误。
 * 2. **声明即存在**：声明的入口路径必须在磁盘上真实存在 —— 拦「子目录/文件名写错」
 *    「某个格式根本没被构建出来」这类扩展名判据看不到的错误。`pnpm build` 是本仓库
 *    `pnpm test` 的既定前置（AGENTS.md「常用命令」），故可无条件断言。
 * 3. **打包覆盖**：声明的入口必须落在 `files` 白名单内，否则发布出去的 tarball 里根本没有它
 *    —— 与 #1194 同一个失败面（用户装上后 `Cannot find module`）。
 *
 * **检查范围**：`packages/*` 中**非 private** 的包（即会发布到 npm 的那批）。private 包不受
 * 产物契约约束，例如本包直接把 `src/index.ts` 作为入口供 monorepo 内部消费。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** 仓库根（本文件位于 `packages/tsdown-config/test/`） */
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** 产物扩展名候选，**长后缀在前**（`.d.cts` 必须先于 `.js` 匹配） */
const PRODUCT_EXTS = [".d.cts", ".d.mts", ".d.ts", ".cjs", ".mjs", ".js"];

/** 类型声明类扩展名 */
const DTS_EXTS = [".d.cts", ".d.mts", ".d.ts"];

/** 一条入口声明 */
interface EntryDecl {
  /** 来源字段名，用于失败信息定位 */
  field: string;
  /** 相对包目录的路径（原样，如 `./dist/index.cjs`） */
  path: string;
}

/** package.json 中与本测试相关的字段 */
interface PkgManifest {
  /** 包名 */
  name: string;
  /** 模块体系标记 */
  type?: string;
  /** 入口 */
  main?: string;
  /** ESM 入口 */
  module?: string;
  /** 类型声明入口 */
  types?: string;
  /** 条件导出 */
  exports?: unknown;
  /** 可执行文件入口 */
  bin?: unknown;
  /** 打包白名单 */
  files?: string[];
}

/** 待检查的公开包 */
interface PublicPackage {
  /** 包目录（仓库根相对，POSIX 风格） */
  dir: string;
  /** package.json 内容 */
  pkg: PkgManifest;
}

/**
 * 取路径的产物扩展名。
 * @param file 相对路径
 * @returns 扩展名（识别不到返回空串）
 */
function productExt(file: string): string {
  return PRODUCT_EXTS.find((ext) => file.endsWith(ext)) ?? "";
}

/**
 * 该包模块体系允许出现的产物扩展名（镜像 `outExtensions` 的输出范围，见
 * `test/extensions.test.ts`）：
 *
 * - 非 `type: module`：CJS 侧 `.js`、ESM 侧 `.mjs` ⇒ **永远不会有 `.cjs` / `.d.cts`**
 * - `type: module`：双格式为 `.cjs` + `.mjs`，仅 ESM 为 `.js`
 *
 * @param pkg package.json
 * @returns 允许的扩展名
 */
function allowedExtensions(pkg: PkgManifest): string[] {
  return pkg.type === "module"
    ? [".js", ".mjs", ".cjs", ...DTS_EXTS]
    : [".js", ".mjs", ".d.ts", ".d.mts"];
}

/**
 * 收集 package.json 里声明的全部入口路径。
 * @param pkg package.json
 * @returns 入口声明列表
 */
function entryDecls(pkg: PkgManifest): EntryDecl[] {
  const out: EntryDecl[] = [];
  for (const field of ["main", "module", "types"] as const) {
    const value = pkg[field];
    if (typeof value === "string") out.push({ field, path: value });
  }
  // exports：支持字符串形态、`exports["."]` 字符串形态、`exports["."]` 条件对象形态
  const exportsField = pkg.exports;
  const rootExport =
    typeof exportsField === "string"
      ? exportsField
      : exportsField && typeof exportsField === "object"
        ? (exportsField as Record<string, unknown>)["."]
        : undefined;
  if (typeof rootExport === "string") {
    out.push({ field: 'exports["."]', path: rootExport });
  } else if (rootExport && typeof rootExport === "object") {
    for (const [condition, value] of Object.entries(rootExport)) {
      if (typeof value === "string") out.push({ field: `exports["."].${condition}`, path: value });
    }
  }
  // bin：字符串或 { 命令名: 路径 }
  if (typeof pkg.bin === "string") {
    out.push({ field: "bin", path: pkg.bin });
  } else if (pkg.bin && typeof pkg.bin === "object") {
    for (const [name, value] of Object.entries(pkg.bin as Record<string, unknown>)) {
      if (typeof value === "string") out.push({ field: `bin["${name}"]`, path: value });
    }
  }
  return out;
}

/**
 * 路径是否被 `files` 白名单覆盖（npm 语义：命中目录即覆盖其下所有文件）。
 * @param rel 相对包目录的入口路径
 * @param files 打包白名单
 * @returns 命中返回 true
 */
function coveredByFiles(rel: string, files: string[]): boolean {
  const target = rel.replace(/^\.\//, "");
  return files.some((entry) => {
    const prefix = entry.replace(/^\.\//, "").replace(/\/+$/, "");
    return target === prefix || target.startsWith(`${prefix}/`);
  });
}

/**
 * 扫描全部公开包。
 * @returns 非 private 的包（按包名排序，便于稳定输出）
 */
function publicPackages(): PublicPackage[] {
  const packagesDir = join(REPO_ROOT, "packages");
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      dir: `packages/${entry.name}`,
      manifest: join(packagesDir, entry.name, "package.json"),
    }))
    .filter(({ manifest }) => existsSync(manifest))
    .map(({ dir, manifest }) => ({
      dir,
      pkg: JSON.parse(readFileSync(manifest, "utf8")) as PkgManifest,
    }))
    .filter(({ pkg }) => (pkg as PkgManifest & { private?: boolean }).private !== true)
    .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
}

describe("公开包入口字段与构建产物一致", () => {
  const packages = publicPackages();

  it("扫描到的公开包数量合理（防止过滤条件写错导致空跑）", () => {
    expect(packages.length).toBeGreaterThanOrEqual(5);
  });

  for (const { dir, pkg } of packages) {
    const declared = entryDecls(pkg);

    describe(pkg.name, () => {
      it("入口声明的扩展名符合产物扩展名契约", () => {
        const allowed = allowedExtensions(pkg);
        const bad = declared
          .filter(({ path }) => productExt(path) !== "" && !allowed.includes(productExt(path)))
          .map(({ field, path }) => `${field}: ${path}（${pkg.type ?? "commonjs"} 包不会产出该扩展名）`);
        expect(bad, "非 module 包的 CJS 产物是 .js，不是 .cjs").toEqual([]);
      });

      it("条件导出的 import / require 扩展名与模块体系匹配", () => {
        const rootExport = (pkg.exports as Record<string, unknown> | undefined)?.["."];
        if (!rootExport || typeof rootExport !== "object") return;
        const conditions = rootExport as Record<string, unknown>;
        if (typeof conditions.import === "string") {
          expect(productExt(conditions.import), `exports["."].import`).toBe(".mjs");
        }
        if (typeof conditions.require === "string") {
          expect(productExt(conditions.require), `exports["."].require`).toBe(
            pkg.type === "module" ? ".cjs" : ".js",
          );
        }
      });

      it("入口声明的文件真实存在（依赖 `pnpm build` 前置）", () => {
        const missing = declared
          .filter(({ path }) => !existsSync(join(REPO_ROOT, dir, path)))
          .map(({ field, path }) => `${field}: ${path}`);
        expect(missing, `包目录 ${dir}`).toEqual([]);
      });

      it("入口声明被 files 白名单覆盖", () => {
        const files = Array.isArray(pkg.files) ? pkg.files : [];
        if (files.length === 0) return; // 未声明 files = 全量打包，无需检查
        const uncovered = declared
          .filter(({ path }) => !coveredByFiles(path, files))
          .map(({ field, path }) => `${field}: ${path}（files: ${JSON.stringify(files)}）`);
        expect(uncovered, "入口不在 files 里 ⇒ 发出去的包缺少入口文件").toEqual([]);
      });
    });
  }
});

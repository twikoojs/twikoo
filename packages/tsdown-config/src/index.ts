import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OutExtensionFactory, TsdownPlugin } from "tsdown";

/**
 * 版本占位符字符串。
 *
 * 各包 `src/version.ts` 中 `VERSION` 常量恒为该字符串，构建时由
 * {@link createVersionPlugin} 改写为被构建包 `package.json` 的 version。
 * 本地开发构建得到 `0.0.0`；CI 发布时先由 release 流程改写 `package.json` 的
 * version，构建产物即携带真实版本号（设计决策 D-13）。
 */
export const VERSION_PLACEHOLDER = "__TWIKOO_VERSION__";

/**
 * 产物语法目标（仓库基线 ES2022，浏览器基线 Chrome/Edge 94+、Firefox 93+、
 * Safari 15.4+，与根 `tsconfig.base.json` 的 target 一致）。
 */
export const BUILD_TARGET = "es2022";

/** 被构建包的清单信息，仅取构建需要的字段 */
interface PackageManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * 读取被构建包的 `package.json`。
 *
 * 以 tsdown 进程的工作目录为准——`pnpm --filter <pkg> build` 会在该包目录下
 * 执行 tsdown。缺少 version 字段时直接抛错，避免静默产出错误版本号。
 */
export function readManifest(cwd: string = process.cwd()): PackageManifest {
  const manifestPath = join(cwd, "package.json");
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<PackageManifest>;
  if (!parsed.version) {
    throw new Error(`[tsdown-config] 无法从 ${manifestPath} 读取 version 字段`);
  }
  return {
    name: parsed.name ?? "unknown",
    version: parsed.version,
    dependencies: parsed.dependencies,
    peerDependencies: parsed.peerDependencies,
    devDependencies: parsed.devDependencies,
  };
}

/**
 * 解析被构建包 `dependencies` 的键列表（适配器/库包用：
 * 运行时由部署环境安装提供，一律不打包进产物）。
 */
export function neverBundleDependencies(cwd: string = process.cwd()): string[] {
  return Object.keys(readManifest(cwd).dependencies ?? {});
}

/**
 * 解析被构建包 `dependencies` + `peerDependencies` + `devDependencies` 的
 * 键列表（`@twikoojs/common` 用：重依赖以 peer 声明、开发依赖亦不得混入产物）。
 */
export function neverBundleAllDependencies(cwd: string = process.cwd()): string[] {
  const manifest = readManifest(cwd);
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
}

/**
 * 生成产物扩展名解析函数，固定 tsup 时代的产物命名契约。
 *
 * tsdown 的默认扩展名不感知 `package.json` 的 `type` 与格式组合，会破坏既有
 * `exports`/`main`/`bin` 路径（如 tkserver bin 的 `dist/server.js`），因此按
 * 下表显式固定（`formats` 传该配置的 `format` 数组，用于判断是否存在 CJS 产物）：
 *
 * | package.json `type` | format        | js            | dts             |
 * | ------------------- | ------------- | ------------- | --------------- |
 * | `"module"`          | esm / cjs     | `.mjs` / `.cjs` | `.d.ts` / `.d.cts` |
 * | `"module"`          | 仅 esm        | `.js`         | `.d.ts`         |
 * | 其余（commonjs）     | esm / cjs     | `.mjs` / `.js` | `.d.mts` / `.d.ts` |
 *
 * dts 命名规则：`types` 字段解析侧（module 包为 ESM 侧、commonjs 包为 CJS 侧）
 * 恒为 `.d.ts`，另一侧用 `.d.mts` / `.d.cts` 后缀区分。
 *
 * 注意 rolldown 内部把 ES 格式规范成 `"es"`，判据统一用 `"cjs"`。
 */
export function outExtensions(formats: readonly string[]): OutExtensionFactory {
  const hasCjs = formats.includes("cjs");
  return ({ format, pkgType }) => {
    const isModulePkg = pkgType === "module";
    if (format === "cjs") {
      return isModulePkg ? { js: ".cjs", dts: ".d.cts" } : { js: ".js", dts: ".d.ts" };
    }
    if (isModulePkg) {
      return hasCjs ? { js: ".mjs", dts: ".d.ts" } : { js: ".js", dts: ".d.ts" };
    }
    return { js: ".mjs", dts: ".d.mts" };
  };
}

/**
 * 创建版本占位符替换插件。
 *
 * 在加载 `version.ts` 源模块时把其中的占位符字面量就地替换为真实版本号
 * （仅替换内容、保留引号），下游 sourcemap 以替换后的内容为源头生成、
 * 保持自洽，从而让产物天然携带正确版本。
 */
export function createVersionPlugin(version: string): TsdownPlugin {
  return {
    name: "twikoo-version-placeholder",
    /** 加载 version.ts 源模块时替换占位符，其余模块放行默认加载器 */
    load(id) {
      if (!/version\.(ts|mts|cts|js|mjs|cjs)$/.test(id)) return null;
      const source = readFileSync(id, "utf8");
      if (!source.includes(VERSION_PLACEHOLDER)) return null;
      return { code: source.split(VERSION_PLACEHOLDER).join(version) };
    },
  };
}

/**
 * 递归扫描输出目录，把仍残留的版本占位符替换为真实版本号。
 *
 * {@link createVersionPlugin} 只处理参与打包的 JS 产物；类型声明（`.d.ts`）由
 * dts 流程单独生成、不经过该插件，因此在构建成功回调中再做一次兜底替换，
 * 保证 dist 下任何产物都不残留占位符。
 */
export function sweepVersionPlaceholder(dir: string, version: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      sweepVersionPlaceholder(fullPath, version);
      continue;
    }
    const contents = readFileSync(fullPath, "utf8");
    if (contents.includes(VERSION_PLACEHOLDER)) {
      writeFileSync(fullPath, contents.split(VERSION_PLACEHOLDER).join(version), "utf8");
    }
  }
}

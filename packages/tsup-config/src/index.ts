import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Options } from "tsup";

/**
 * 版本占位符字符串。
 *
 * 各包的 `src/version.ts` 中 `VERSION` 常量恒为该字符串，构建时由
 * {@link defineConfig} 注入的版本替换插件改写为被构建包 `package.json` 的 version。
 * 本地开发构建得到 `0.0.0`；CI 发布时先由 release 流程改写 `package.json` 的 version，
 * 构建产物即携带真实版本号（设计决策 D-13）。
 */
export const VERSION_PLACEHOLDER = "__TWIKOO_VERSION__";

/** esbuild 插件类型（从 tsup 的 Options 派生，避免引入 esbuild 直接依赖） */
type EsbuildPlugin = NonNullable<Options["esbuildPlugins"]>[number];

/** 被构建包的清单信息，仅取构建需要的 name 与 version */
interface PackageManifest {
  name: string;
  version: string;
}

/**
 * 读取被构建包的 `package.json`。
 *
 * 以 tsup 进程的工作目录为准——`pnpm --filter <pkg> build` 会在该包目录下执行 tsup。
 * 缺少 version 字段时直接抛错，避免静默产出错误版本号。
 */
function readPackageManifest(cwd: string): PackageManifest {
  const manifestPath = join(cwd, "package.json");
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<PackageManifest>;
  if (!parsed.version) {
    throw new Error(`[tsup-config] 无法从 ${manifestPath} 读取 version 字段`);
  }
  return { name: parsed.name ?? "unknown", version: parsed.version };
}

/**
 * 递归扫描输出目录，把仍残留的版本占位符替换为真实版本号。
 *
 * esbuild 插件只处理参与打包的 JS/CJS 产物，类型声明（`.d.ts`）由 tsup 的 dts
 * 流程（rollup-plugin-dts）单独生成、不经过 esbuild，因此在构建成功回调中再做一次
 * 兜底替换，保证 dist 下任何产物都不残留占位符。
 */
function sweepVersionPlaceholder(dir: string, version: string): void {
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

/**
 * 创建版本占位符替换插件。
 *
 * 在 esbuild 加载模块时拦截包含占位符的源文件，把 `version.ts` 源码中的
 * `'__TWIKOO_VERSION__'` 就地替换为真实版本号（仅替换内容、保留引号），
 * 从而让 ESM/CJS 产物天然携带正确版本。
 */
function createVersionPlugin(version: string): EsbuildPlugin {
  return {
    name: "twikoo-version-placeholder",
    setup(build) {
      build.onLoad({ filter: /version\.(ts|mts|cts|js|mjs|cjs)$/ }, async (args) => {
        const source = await readFile(args.path, "utf8");
        if (!source.includes(VERSION_PLACEHOLDER)) return null;
        return { contents: source.split(VERSION_PLACEHOLDER).join(version), loader: "ts" };
      });
    },
  };
}

/**
 * 共享 tsup 配置工厂。
 *
 * 统一产出双格式产物（ESM `.mjs` + CJS `.cjs`）与类型声明（`.d.ts`），
 * 注入版本占位符替换插件与 `onSuccess` 兜底扫描，并生成含包名与版本的 banner。
 * 调用方可传入 `Options` 覆盖默认值（`esbuildPlugins` 为追加合并，不会丢失版本插件）。
 */
export function defineConfig(options: Options = {}): Options {
  const cwd = process.cwd();
  const { name, version } = readPackageManifest(cwd);
  const outDirOption = options.outDir ?? "dist";
  const outDir = Array.isArray(outDirOption) ? outDirOption[0] : outDirOption;
  const consumerOnSuccess = options.onSuccess;

  const base: Options = {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".mjs" };
    },
    banner: { js: `/*! ${name} v${version} */` },
    esbuildPlugins: [createVersionPlugin(version)],
    onSuccess: async () => {
      sweepVersionPlaceholder(join(cwd, outDir), version);
    },
  };

  return {
    ...base,
    ...options,
    banner: options.banner ?? base.banner,
    outExtension: options.outExtension ?? base.outExtension,
    esbuildPlugins: [createVersionPlugin(version), ...(options.esbuildPlugins ?? [])],
    onSuccess: async () => {
      sweepVersionPlaceholder(join(cwd, outDir), version);
      if (typeof consumerOnSuccess === "function") await consumerOnSuccess();
    },
  };
}

export default defineConfig;

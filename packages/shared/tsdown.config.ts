import { join } from "node:path";
import { defineConfig } from "tsdown";
import {
  BUILD_TARGET,
  createVersionPlugin,
  outExtensions,
  readManifest,
  sweepVersionPlaceholder,
} from "@twikoojs/tsdown-config";

/**
 * `@twikoojs/shared` 的 tsdown 构建配置。
 *
 * 双格式（`.mjs` + `.cjs`）+ 类型声明，并注入版本占位符替换插件与含包名/版本
 * 的 banner（版本号契约见 `src/version.ts`）。
 */
const pkg = readManifest();

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm", "cjs"]),
  banner: { js: `/*! ${pkg.name} v${pkg.version} */` },
  plugins: [createVersionPlugin(pkg.version)],
  /** 构建完成后兜底替换类型声明中的版本占位符 */
  onSuccess: async () => {
    sweepVersionPlaceholder(join(process.cwd(), "dist"), pkg.version);
  },
});

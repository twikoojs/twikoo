import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * twikoo-netlify 构建配置：ESM + CJS；dependencies 全部 external。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm", "cjs"]),
  deps: { neverBundle: neverBundleDependencies() },
  /** CJS 同时提供旧 handler 与现代 default，显式使用命名导出消除混合导出警告。 */
  outputOptions: (options, format) =>
    format === "cjs" ? { ...options, exports: "named" } : options,
});

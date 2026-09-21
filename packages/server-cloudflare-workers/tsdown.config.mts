import { defineConfig } from "tsdown";
import {
  BUILD_TARGET,
  createVersionPlugin,
  neverBundleDependencies,
  outExtensions,
  readManifest,
} from "@twikoojs/tsdown-config";

/**
 * Cloudflare Workers 适配器构建配置：输出 ESM 与 CJS 类型声明。
 * 运行时依赖保持 external，由 Wrangler 负责最终 Workers bundle。
 * 版本占位符由 createVersionPlugin 在构建时替换。
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
  deps: { neverBundle: neverBundleDependencies() },
  plugins: [createVersionPlugin(pkg.version)],
  /** CJS 产物同时保留 default 与具名导出，兼容 require() 部署壳。 */
  outputOptions: (options, format) =>
    format === "cjs"
      ? {
          ...options,
          exports: "named",
          footer: "module.exports = Object.assign(module.exports.default, module.exports);",
        }
      : options,
});

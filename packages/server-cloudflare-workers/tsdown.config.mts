import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * Cloudflare Workers 适配器构建配置：输出 ESM 与 CJS 类型声明。
 * 运行时依赖保持 external，由 Wrangler 负责最终 Workers bundle。
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

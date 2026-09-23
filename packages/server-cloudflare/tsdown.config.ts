import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * twikoo-cloudflare 构建配置：纯 ESM（Workers 只吃 ESM）。
 * dependencies 全部 external —— 由部署方在包目录 `npm install` 后交给 wrangler 打包
 * （wrangler 自己会用 esbuild 把这些依赖编进 Worker 产物，并做 tree-shaking）。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm"]),
  deps: { neverBundle: neverBundleDependencies() },
});

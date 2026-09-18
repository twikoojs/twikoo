import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * twikoo-edgeone-makers 构建配置：纯 ESM（EdgeOne Makers 为浏览器系运行时）。
 * dependencies 全部 external（重依赖禁令：EO bundle 不得混入 nodemailer/jsdom 等）。
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

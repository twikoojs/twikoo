import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleAllDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * @twikoojs/common 构建：ESM + CJS 双格式 + 类型声明。
 * dependencies/peerDependencies/devDependencies 全部 external
 * （重依赖由适配器安装；@twikoojs/shared 独立发布）。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm", "cjs"]),
  deps: { neverBundle: neverBundleAllDependencies() },
});

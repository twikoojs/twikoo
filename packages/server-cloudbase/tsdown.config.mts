import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * twikoo-func 构建配置：ESM + CJS 双格式 + 类型声明。
 * dependencies 全部 external（运行时由 CloudBase 环境安装提供，
 * @twikoojs/common 以发布包形态被 require——不打包进适配器产物）。
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
});

import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * pushoo 构建配置：ESM + CJS 双格式 + 类型声明（§3.2 产物要求）。
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

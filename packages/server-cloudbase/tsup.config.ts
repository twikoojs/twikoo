import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

/**
 * twikoo-func 构建配置：ESM + CJS 双格式 + 类型声明。
 * dependencies 全部 external（运行时由 CloudBase 环境安装提供，
 * @twikoojs/common 以发布包形态被 require——不打包进适配器产物）。
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: Object.keys(pkg.dependencies ?? {}),
});

import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

/**
 * twikoo-edgeone-makers 构建配置：纯 ESM（EdgeOne Makers 为浏览器系运行时）。
 * dependencies 全部 external（重依赖禁令：EO bundle 不得混入 nodemailer/jsdom 等）。
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: Object.keys(pkg.dependencies ?? {}),
});

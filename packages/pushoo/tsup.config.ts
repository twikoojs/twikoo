import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

/** pushoo 构建配置：ESM + CJS 双格式 + 类型声明（§3.2 产物要求）。 */
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

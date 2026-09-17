import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

/** twikoo-vercel-min 构建配置：ESM + CJS；twikoo-vercel 保持 external（转发壳）。 */
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

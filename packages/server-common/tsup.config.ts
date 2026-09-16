import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

/**
 * @twikoojs/common 构建：ESM + CJS 双格式 + 类型声明。
 * dependencies/peerDependencies 全部 external（D-2：重依赖由适配器安装；
 * @twikoojs/shared 独立发布）。
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // 双格式显式扩展名（esm→.mjs / cjs→.cjs，与 exports 映射一致）
  /**
   *
   */
  outExtension: ({ format }: { format: "esm" | "cjs" }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ],
});

import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

/**
 * tkserver 构建配置：ESM + CJS 双格式 + bin 入口（shebang）。
 * dependencies 全部 external（运行时由部署环境安装提供）。
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: Object.keys(pkg.dependencies ?? {}),
  },
  {
    entry: { server: "src/server.ts" },
    format: ["cjs"],
    sourcemap: true,
    target: "es2022",
    banner: { js: "#!/usr/bin/env node" },
    external: Object.keys(pkg.dependencies ?? {}),
  },
]);

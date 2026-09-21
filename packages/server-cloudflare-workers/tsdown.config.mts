import { defineConfig } from "tsdown";
import {
  BUILD_TARGET,
  createVersionPlugin,
  outExtensions,
  readManifest,
} from "@twikoojs/tsdown-config";

const pkg = readManifest();

/**
 * workspace 依赖必须打入产物：用户 `wrangler deploy` 时不经过 monorepo 构建，
 * Wrangler 从 `dist/index.mjs` 重新 bundle，外部化的 workspace 包无法解析。
 * tsdown 默认将 dependencies 全部 external，用 alwaysBundle 覆盖 workspace 包。
 */
const alwaysBundle = Object.entries(pkg.dependencies ?? {})
  .filter(([, v]) => String(v).startsWith("workspace:"))
  .map(([k]) => k);

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm", "cjs"]),
  deps: { alwaysBundle, onlyBundle: false },
  plugins: [createVersionPlugin(pkg.version)],
  outputOptions: (options, format) =>
    format === "cjs"
      ? {
          ...options,
          exports: "named",
          footer: "module.exports = Object.assign(module.exports.default, module.exports);",
        }
      : options,
});

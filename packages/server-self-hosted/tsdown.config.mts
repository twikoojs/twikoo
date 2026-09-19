import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * tkserver 构建配置：ESM + CJS 双格式 + bin 入口（shebang）。
 * dependencies 全部 external（运行时由部署环境安装提供）。
 */
export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: BUILD_TARGET,
    outExtensions: outExtensions(["esm", "cjs"]),
    deps: { neverBundle: neverBundleDependencies() },
  },
  {
    entry: { server: "src/bin.ts" },
    format: ["cjs"],
    // bin 构建 cleaner 默认开启会清掉第一个配置的产物，必须显式关闭；
    // package.json 含 types 字段会使 dts 自动启用，bin 入口无需声明产物
    clean: false,
    dts: false,
    sourcemap: true,
    target: BUILD_TARGET,
    banner: { js: "#!/usr/bin/env node" },
    outExtensions: outExtensions(["cjs"]),
    deps: { neverBundle: neverBundleDependencies() },
  },
]);

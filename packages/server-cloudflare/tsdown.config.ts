import { defineConfig } from "tsdown";
import { fileURLToPath } from "node:url";
import { BUILD_TARGET, outExtensions } from "@twikoojs/tsdown-config";

/** 仅替换已关闭或已由原生实现覆写的公共层依赖。 */
const unavailableLibs = [
  "@imaegoo/node-ip2region",
  "akismet-api",
  "tencentcloud-sdk-nodejs-tms",
  "lokijs",
];
const libStub = fileURLToPath(new URL("./src/lib-stubs.ts", import.meta.url));

/**
 * 预打包 workspace 与真实 jsdom 依赖，避免 Wrangler 的 whatwg-url 替身破坏 DOM 初始化。
 * 保留 Node require 给 Wrangler 处理，不生成依赖 import.meta.url 的 createRequire 垫片。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm"]),
  alias: Object.fromEntries(unavailableLibs.map((name) => [name, libStub])),
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  outputOptions: { polyfillRequire: false },
});

/**
 * demo 工程共享常量（`vite.config.ts` / 测试 / 根编排脚本三方复用）。
 *
 * 设计约束：本文件**不得**用 `import.meta.url` 推导路径——Vite 会把
 * `vite.config.ts` 与其 import 的 TS 文件一起打包成同级临时文件，
 * `import.meta.url` 届时指向打包产物而非源文件目录（差一层，路径全错）。
 * 路径推导一律留在 `vite.config.ts`（与配置同级）与 `scripts/*.mjs`（真实文件）内。
 */

/** demo 页（含客户端产物直供）dev server 端口（沿用 1.x 的 9820）*/
export const DEMO_PORT = 9820;

/** tkserver 后端端口 */
export const SERVER_PORT = 8080;

/** demo 页默认填入的后端地址——开箱即用无需手填 */
export const DEFAULT_BACKEND_URL = `http://localhost:${SERVER_PORT}`;

/** demo 页 localStorage 键前缀（1.x 行为保留：envId/region/path/lang 四项持久化） */
export const DEMO_STORAGE_PREFIX = "twikoo-demo-";

/**
 * 客户端产物文件名（由 `packages/client/dist` 直供根路径，文件名与 1.7.24 一致）。
 * 与 `packages/client/build.mjs` 的 PRODUCTS 表一一对应，外加样式产物 `twikoo.css`。
 */
export const CLIENT_PRODUCT_FILES = [
  "twikoo.min.js",
  "twikoo.all.min.js",
  "twikoo.nocss.js",
  "twikoo.all.nocss.js",
  "twikoo.css",
] as const;

/** 本地化 vendor 资产目录名（`scripts/prepare-assets.mjs` 产出，已入 .gitignore） */
export const VENDOR_DIR_NAME = ".vendor";

/**
 * Vercel 一键部署入口：纯转发壳，实现全在 `twikoo-vercel`。
 *
 * 必须保持纯 JS 且自包含——Vercel 只克隆本目录、`npm install` 后直接加载这个文件，
 * 不会执行本仓库的 monorepo 构建，因此这里不能 import TS 源码、也不能依赖 `workspace:*`。
 *
 * 导出形态兼容两代发布包：2.0 的双格式产物按 ESM 语义导出（CJS 侧是 `exports.default`，
 * 带 `__esModule` 标记），1.7.x 则是 `module.exports = <handler>` 直接给函数。
 * Vercel 需要的是可调用函数，所以取 `.default`，没有再退回模块本身。
 *
 * ⚠️ 维护须知：`vercel.json` 的 `functions.includeFiles` 列了 `twikoo-vercel` 的**重依赖**，
 * 必须与 `packages/server-common/src/utils/lib-loader.ts` 里动态加载的包保持一致。
 *
 * 原因：lib-loader 为了不让构建器把 specifier 静态解析，故意用**变量**做动态 import，
 * Vercel 的 `@vercel/nft` 因此追踪不到这些包，它们不会被打进函数产物 —— 运行时报
 * `LibLoadError`（如「缺少依赖 form-data」）。新增/移除动态加载的依赖时，记得同步那份列表。
 */
const vercel = require("twikoo-vercel");

module.exports = vercel.default ?? vercel;
module.exports.default = module.exports;

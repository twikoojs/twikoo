/**
 * Vercel 一键部署入口：纯转发壳，实现全在 `twikoo-vercel`。
 *
 * 必须保持纯 JS 且自包含——Vercel 只克隆本目录、`npm install` 后直接加载这个文件，
 * 不会执行本仓库的 monorepo 构建，因此这里不能 import TS 源码、也不能依赖 `workspace:*`。
 *
 * 导出形态兼容两代发布包：2.0 的双格式产物按 ESM 语义导出（CJS 侧是 `exports.default`，
 * 带 `__esModule` 标记），1.7.x 则是 `module.exports = <handler>` 直接给函数。
 * Vercel 需要的是可调用函数，所以取 `.default`，没有再退回模块本身。
 */
const vercel = require("twikoo-vercel");

module.exports = vercel.default ?? vercel;
module.exports.default = module.exports;

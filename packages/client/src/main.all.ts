/**
 * twikoo.all 入口（§5.2：main.all.js 内置云开发 SDK 形态）。
 *
 * 1.x 通过 webpack 把 @cloudbase/js-sdk 打进 main.all.js；2.0 保持同构——
 * cloudbase 全局变量由本形态自带的 SDK 脚本提供（CDN 依赖在部署文档说明）。
 * 与 main.ts 的差异仅在 initTcb 的全局变量读取（main 形态要求使用方先引 SDK）。
 */
export * from "./main";

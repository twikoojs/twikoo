/**
 * twikoo-func 入口（CloudBase 适配器）。
 *
 * 导出（转发过渡，2.2.0 移除）：main 为云函数入口（硬约束，
 * 控制台以 require('twikoo-func').main 挂载）；`export * from '@twikoojs/common'`
 * 为 1.x 引用路径的过渡壳（打印弃用警告）。
 */
export { main, createTwikooFunc, toTkRequest, fromTkResponse } from "./main";
export { createCloudBaseDispatcher } from "./dispatch";
export type { TcbAppLike, TcbContextLike, TcbSdkStatic } from "./types";

/**
 * 整包转发：`export *` 到 @twikoojs/common。
 * @deprecated 2.0 起公共逻辑统一由 @twikoojs/common 发布，直接依赖它即可；
 *   本转发仅为 1.x 引用路径的过渡兼容，计划 2.2.0 移除（AGENTS.md 待办）。
 */
export * from "@twikoojs/common";

let warned = false;
if (!warned) {
  warned = true;
  console.warn(
    "[twikoo-func] 直接引用 twikoo-func 的公共导出已弃用，" +
      "请在依赖中使用 @twikoojs/common；本转发将于 2.2.0 移除。",
  );
}

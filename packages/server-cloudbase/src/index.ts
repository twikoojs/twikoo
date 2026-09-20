/**
 * twikoo-func 入口（CloudBase 适配器）。
 *
 * `main` 为云函数入口（**硬约束**：控制台以 `require('twikoo-func').main` 挂载，不可改名）。
 * 公共逻辑统一由 `@twikoojs/common` 发布——1.x 时代的「整包转发」过渡壳
 * （`export * from "@twikoojs/common"` + 加载即打印的弃用告警）已于 2026-09-19 移除，
 * 原计划 2.2.0，确认无外部依赖后提前执行；引用公共逻辑请直接用 `@twikoojs/common`。
 */
export { main, createTwikooFunc, toTkRequest, fromTkResponse } from "./main";
export { createCloudBaseDispatcher } from "./dispatch";
export type { TcbAppLike, TcbContextLike, TcbSdkStatic } from "./types";

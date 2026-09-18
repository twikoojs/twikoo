/**
 * 事件处理器注册表（规范 §6.2 handlers/ 的装配机制）。
 *
 * dispatcher 通过本表把事件名解析到 handler 实现：T13 只注册
 * GET_FUNC_VERSION 与三个兼容分支（D-4），其余 24 个常规事件随 T18 迁移
 * 逐个登记。注册表同时是契约测试（T19）的接缝——测试可注册替身 handler
 * 验证 dispatcher 转发逻辑，或注入真实实现跑全事件断言。
 */
import type { TwikooEvent } from "@twikoojs/shared";
import type { EventHandler } from "./types";

/** 事件名 → 处理器 的注册表（模块级单例，进程生命周期内有效） */
const registry = new Map<TwikooEvent, EventHandler>();

/**
 * 注册（或覆盖）一个事件处理器。
 * @param event 事件名（@twikoojs/shared 事件常量）
 * @param handler 处理器实现
 */
export function registerHandler(event: TwikooEvent, handler: EventHandler): void {
  registry.set(event, handler);
}

/**
 * 解析事件处理器；未注册返回 undefined（由调用方决定报错形态）。
 * @param event 事件名
 * @returns 处理器实现或 undefined
 */
export function resolveHandler(event: TwikooEvent): EventHandler | undefined {
  return registry.get(event);
}

/**
 * 清空注册表（测试复位用；清空后须调用 registerDefaultHandlers() 恢复默认）。
 */
export function resetHandlers(): void {
  registry.clear();
}

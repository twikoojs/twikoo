/**
 * 事件处理器装配（规范 §6.2 handlers/）。
 *
 * T13 注册 4 个已就绪事件；其余 24 个常规事件随 T18 迁移在本文件逐个
 * 登记（一事件一文件）。dispatcher 模块加载时 import 本文件触发默认注册。
 */
import { GET_FUNC_VERSION, HIDDEN, POST_SUBMIT, VISIBLE } from "@twikoojs/shared";
import { registerHandler } from "../core/handler-registry";
import { getFuncVersion } from "./get-func-version";
import { postSubmitEvent } from "./post-submit";
import { hiddenEvent } from "./hidden";
import { visibleEvent } from "./visible";

/**
 * 注册默认事件处理器集（模块加载时执行一次；测试可在 resetHandlers() 后
 * 重新调用以恢复默认注册表）。
 */
export function registerDefaultHandlers(): void {
  registerHandler(GET_FUNC_VERSION, getFuncVersion);
  // 以下三个为 @deprecated 兼容分支（D-4 双支持，2.2.0 移除）
  registerHandler(POST_SUBMIT, postSubmitEvent);
  registerHandler(HIDDEN, hiddenEvent);
  registerHandler(VISIBLE, visibleEvent);
}

registerDefaultHandlers();

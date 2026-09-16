/**
 * GET_FUNC_VERSION 事件处理器（1.7.24 getFuncVersion 语义对齐）。
 */
import { VERSION } from "@twikoojs/shared";
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";

/**
 * 获取 Twikoo 云函数版本：返回 `{ code: 0, version }`（1.x 形态一致）。
 * version 来自 @twikoojs/shared 的构建期占位符（发布时由 tsup 插件注入实际值）。
 * @param ctx 请求上下文（本处理器不消费上下文数据）
 * @returns 版本响应体
 */
export const getFuncVersion: EventHandler = () => ({
  code: RES_CODE.SUCCESS,
  version: VERSION,
});

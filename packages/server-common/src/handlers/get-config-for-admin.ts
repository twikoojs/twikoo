/**
 * GET_CONFIG_FOR_ADMIN 事件处理器（1.x getConfigForAdmin 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { getConfigForAdmin } from "../services/config";
import { isAdmin } from "../services/user";

/**
 * 管理员读取全量配置（摘除 CREDENTIALS）。
 * @param ctx 请求上下文
 * @returns 全量配置响应
 */
export const getConfigForAdminEvent: EventHandler = (ctx) =>
  getConfigForAdmin(ctx.config, isAdmin(ctx.config, ctx.accessToken));

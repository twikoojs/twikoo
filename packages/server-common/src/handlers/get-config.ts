/**
 * GET_CONFIG / GET_CONFIG_FOR_ADMIN / SET_CONFIG / LOGIN 事件处理器
 * （1.x 语义对齐，四个薄事件合并于各自文件——见同目录其余文件）。
 */
import type { EventHandler } from "../core/types";
import { getPublicConfig } from "../services/config";
import { isAdmin } from "../services/user";

/**
 * GET_CONFIG：读取对外公开配置（白名单字段 + 验证码供应商定向下发）。
 * @param ctx 请求上下文
 * @returns 公开配置响应
 */
export const getConfig: EventHandler = (ctx) =>
  getPublicConfig(ctx.config, isAdmin(ctx.config, ctx.accessToken));

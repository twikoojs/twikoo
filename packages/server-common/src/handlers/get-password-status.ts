/**
 * GET_PASSWORD_STATUS 事件处理器（1.x getPasswordStatus 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { getPasswordStatus } from "../services/user";
import { VERSION } from "@twikoojs/shared";

/**
 * 判断是否存在管理员密码（前端据此决定是否显示初始化/登录入口）。
 * @param ctx 请求上下文
 * @returns 状态响应
 */
export const getPasswordStatusEvent: EventHandler = (ctx) => getPasswordStatus(ctx.config, VERSION);

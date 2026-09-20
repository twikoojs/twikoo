/**
 * LOGIN 事件处理器（1.x login 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { login } from "../services/user";

/**
 * 管理员登录（密码校验；成功仅返回 code 0，token 由客户端本地计算）。
 * @param ctx 请求上下文
 * @returns 登录响应
 */
export const loginEvent: EventHandler = (ctx) => login(ctx.config, ctx.request.body.password);

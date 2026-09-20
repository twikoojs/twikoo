/**
 * EMAIL_TEST 事件处理器（1.x emailTest 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { emailTest } from "../services/notify";
import { isAdmin } from "../services/user";

/**
 * 邮件测试（管理员；重置传输器后按最新配置发送测试邮件）。
 * @param ctx 请求上下文
 * @returns 测试响应
 */
export const emailTestEvent: EventHandler = (ctx) =>
  emailTest({
    mail: ctx.request.body.mail as string | undefined,
    config: ctx.config,
    isAdminUser: isAdmin(ctx.config, ctx.accessToken),
    caps: ctx.adapters.capabilities,
    logger: ctx.logger,
  });

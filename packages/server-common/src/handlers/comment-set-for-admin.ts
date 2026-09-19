/**
 * COMMENT_SET_FOR_ADMIN 事件处理器（1.x commentSetForAdmin 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import { isAdmin } from "../services/user";

/**
 * 管理员修改评论（$set 部分更新 + updated 时间戳）。
 * @param ctx 请求上下文
 * @returns 更新响应
 */
export const commentSetForAdmin: EventHandler = async (ctx) => {
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  const event = ctx.request.body;
  validate(event, ["id", "set"]);
  await ctx.adapters.database.updateComment(event.id as string, {
    ...(event.set as Record<string, unknown>),
    updated: Date.now(),
  });
  return { code: RES_CODE.SUCCESS, updated: 1 };
};

/**
 * COMMENT_DELETE_FOR_ADMIN 事件处理器（1.x commentDeleteForAdmin 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import { isAdmin } from "../services/user";

/**
 * 管理员删除评论。
 * @param ctx 请求上下文
 * @returns 删除响应
 */
export const commentDeleteForAdmin: EventHandler = async (ctx) => {
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  const event = ctx.request.body;
  validate(event, ["id"]);
  await ctx.adapters.database.deleteComment(event.id as string);
  return { code: RES_CODE.SUCCESS, deleted: 1 };
};

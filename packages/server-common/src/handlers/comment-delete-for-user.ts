/**
 * COMMENT_DELETE_FOR_USER 事件处理器（1.x commentDeleteForUser 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { checkCommentOwnership } from "../services/user";

/**
 * 用户删除自己的评论（归属校验失败转 code 1000 错误体）。
 * @param ctx 请求上下文
 * @returns 删除响应
 */
export const commentDeleteForUser: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  try {
    const uid = ctx.accessToken;
    const event = ctx.request.body;
    await checkCommentOwnership(event.id, uid, async (id) => ctx.adapters.database.getComment(id));
    await ctx.adapters.database.deleteComment(event.id as string);
    res.code = RES_CODE.SUCCESS;
    res.deleted = 1;
  } catch (e) {
    res.code = RES_CODE.FAIL;
    res.message = e instanceof Error ? e.message : String(e);
  }
  return res;
};

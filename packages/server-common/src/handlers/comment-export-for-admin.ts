/**
 * COMMENT_EXPORT_FOR_ADMIN 事件处理器（1.x commentExportForAdmin 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { isAdmin } from "../services/user";

/**
 * 管理员导出评论（collection 缺省 comment；仅支持 comment 集合的语义等价形态）。
 * @param ctx 请求上下文
 * @returns 导出响应（data 为全量评论）
 */
export const commentExportForAdmin: EventHandler = async (ctx) => {
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  const data = await ctx.adapters.database.getAllComments();
  return { code: RES_CODE.SUCCESS, data };
};

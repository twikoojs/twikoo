/**
 * COMMENT_EXPORT_FOR_ADMIN 事件处理器（1.x commentExportForAdmin 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { isAdmin } from "../services/user";

/**
 * 管理员导出数据集合（1.x commentExportForAdmin 语义对齐）。
 * @param ctx 请求上下文
 * @returns 导出响应（data 为对应集合的全量文档）
 */
export const commentExportForAdmin: EventHandler = async (ctx) => {
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  /** 导出集合名（缺省 comment，1.x `event.collection || 'comment'` 对齐） */
  const collection = ctx.request.body.collection ?? "comment";
  if (collection === "comment") {
    return { code: RES_CODE.SUCCESS, data: await ctx.adapters.database.getAllComments() };
  }
  if (collection === "counter") {
    return { code: RES_CODE.SUCCESS, data: await ctx.adapters.database.getAllCounters() };
  }
  return { code: RES_CODE.FAIL, message: "collection 仅支持 comment 或 counter" };
};

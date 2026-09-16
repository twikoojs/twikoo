/**
 * COMMENT_GET_FOR_ADMIN 事件处理器（1.x commentGetForAdmin + getCommentSearchCondition
 * 语义对齐）。HIDDEN / VISIBLE 兼容事件（D-4）转发至此，注入 type 参数。
 */
import { NOT } from "../ports/database";
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import { getSearchKeyword, commentMatchesKeyword } from "../services/comment-query";
import { parseCommentForAdmin } from "../services/comment-dto";
import { isAdmin } from "../services/user";

/**
 * 管理员读取评论列表（分页 + 筛选：VISIBLE/HIDDEN/全部 + 关键词模糊）。
 * @param ctx 请求上下文
 * @returns 管理员评论列表响应（data/count）
 */
export const commentGetForAdmin: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  const event = ctx.request.body;
  validate(event, ["per", "page"]);
  const db = ctx.adapters.database;
  /** 筛选条件（type + 关键词在服务层过滤） */
  const condition: Record<string, unknown> =
    event.type === "VISIBLE"
      ? { isSpam: { [NOT]: true } }
      : event.type === "HIDDEN"
        ? { isSpam: true }
        : {};
  // 关键词过滤在服务层执行（1.x 为 Mongo $regex $or，语义等价的 JS 实现）
  const per = Number(event.per);
  const page = Number(event.page);
  const all = await db.getComments(condition as never, {
    sort: { created: -1 },
    skip: per * (page - 1),
    limit: per,
  });
  const keyword = getSearchKeyword(event);
  const filtered = keyword ? all.filter((c) => commentMatchesKeyword(c, keyword)) : all;
  const data = await parseCommentForAdmin(filtered, ctx.adapters.capabilities);
  res.code = RES_CODE.SUCCESS;
  res.data = data;
  return res;
};

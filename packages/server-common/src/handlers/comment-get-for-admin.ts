/**
 * COMMENT_GET_FOR_ADMIN 事件处理器（1.x commentGetForAdmin + getCommentSearchCondition
 * 语义对齐）。
 *
 * 筛选走请求体的 `type` 字段（1.x 语义）：`"VISIBLE"` / `"HIDDEN"` / 空（全部）。
 * ⚠️ 这两个值是**参数取值，不是事件名**——1.x 从未把 HIDDEN / VISIBLE 作为事件分发，
 * 2.0 亦如此（重构期曾误加为事件分支，已删除）。
 */
import { NOT } from "../ports/database";
import type { CommentDoc } from "../ports/database";
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
  const per = Number(event.per);
  const page = Number(event.page);
  const keyword = getSearchKeyword(event);
  /** 当前页文档 */
  let pageData: CommentDoc[];
  /** 命中总数（分页控件依赖，1.x `res.count` 对齐） */
  let count: number;
  if (keyword) {
    // 关键词过滤在服务层执行（1.x 为 Mongo $regex $or 的 JS 等价实现）。
    // 关键词形态下总数必须按「过滤后」计数，否则分页控件会与实际页数不符。
    const matched = (await db.getComments(condition as never, { sort: { created: -1 } })).filter(
      (c) => commentMatchesKeyword(c, keyword),
    );
    count = matched.length;
    pageData = matched.slice(per * (page - 1), per * (page - 1) + per);
  } else {
    count = await db.countComments(condition as never);
    pageData = await db.getComments(condition as never, {
      sort: { created: -1 },
      skip: per * (page - 1),
      limit: per,
    });
  }
  const data = await parseCommentForAdmin(pageData, ctx.adapters.capabilities);
  res.code = RES_CODE.SUCCESS;
  res.count = count;
  res.data = data;
  return res;
};

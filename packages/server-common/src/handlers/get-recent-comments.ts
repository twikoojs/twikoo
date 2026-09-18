/**
 * GET_RECENT_COMMENTS 事件处理器（1.x getRecentComments 语义对齐）。
 */
import { ABSENT, NOT } from "../ports/database";
import type { EventHandler } from "../core/types";
// lib-loader 静态导入即可（惰性在它内部完成，见其头注释「消费方约定」）
import { getHtmlToText } from "../utils/lib-loader";
import { getAvatar, getMailMd5, getUrlsQuery } from "../services/comment-dto";

/**
 * 获取最新评论（非垃圾、可选页内、缺省不含回复、pageSize 上限 100）。
 * @param ctx 请求上下文
 * @returns 最新评论响应（data: 摘要 DTO 列表）
 */
export const getRecentComments: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  try {
    const event = ctx.request.body;
    const config = ctx.config;
    const db = ctx.adapters.database;
    /** 查询条件：非垃圾 +（可选）页内 +（缺省）顶级 */
    const query: Record<string, unknown> = { isSpam: { [NOT]: true } };
    if (Array.isArray(event.urls) && event.urls.length) {
      query.url = { $in: getUrlsQuery(event.urls as string[]) };
    }
    if (!event.includeReply) query.rid = ABSENT;
    const pageSize = Number(event.pageSize) > 100 ? 100 : Number(event.pageSize) || 10;
    const result = await db.getComments(query as never, {
      sort: { created: -1 },
      limit: pageSize,
    });
    const toText = await getHtmlToText();
    res.data = result.map((comment) => ({
      id: String(comment._id),
      url: comment.url,
      nick: comment.nick,
      avatar: getAvatar(comment, config),
      mailMd5: getMailMd5(comment),
      link: comment.link,
      comment: comment.comment,
      commentText: toText(String(comment.comment ?? "")),
      created: comment.created,
    }));
  } catch (e) {
    res.message = e instanceof Error ? e.message : String(e);
    return res;
  }
  return res;
};

/**
 * GET_RECENT_COMMENTS 事件处理器（1.x getRecentComments 语义对齐）。
 */
import { ABSENT, NOT } from "../ports/database";
import type { CommentDoc, Database } from "../ports/database";
import type { EventHandler } from "../core/types";
// lib-loader 静态导入即可（惰性在它内部完成，见其头注释「消费方约定」）
import { getHtmlToText } from "../utils/lib-loader";
import { getAvatar, getMailMd5, getUrlsQuery } from "../services/comment-dto";

/**
 * 剔除「父评论未通过审核」的回复。
 *
 * 回复自身往往不是垃圾（典型场景：博主回复了一条待审核评论），但它的父评论在页面上
 * 不可见，于是从首页点进文章会看到一条「评论不存在」的回复（#600）。这里按 rid 批量
 * 回查父评论，把父评论 `isSpam` 的回复过滤掉；父评论已删除（查不到）的不动，保持原行为。
 *
 * 取舍：过滤发生在分页之后，因此这一页可能少于 pageSize 条。跨库没有 join，无法在查询层
 * 完成；对「最新评论」这类展示型列表是可接受的。
 * @param db 数据库适配器
 * @param comments 已按查询条件取出的评论
 * @returns 过滤后的评论列表
 */
async function dropHiddenParentReplies(
  db: Database,
  comments: CommentDoc[],
): Promise<CommentDoc[]> {
  const rids = [...new Set(comments.map((c) => c.rid).filter((r): r is string => Boolean(r)))];
  if (!rids.length) return comments;
  const parents = await db.getComments({ _id: rids });
  const hidden = new Set(parents.filter((p) => p.isSpam === true).map((p) => String(p._id)));
  return comments.filter((c) => !c.rid || !hidden.has(String(c.rid)));
}

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
    const visible = event.includeReply ? await dropHiddenParentReplies(db, result) : result;
    const toText = await getHtmlToText();
    res.data = visible.map((comment) => ({
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

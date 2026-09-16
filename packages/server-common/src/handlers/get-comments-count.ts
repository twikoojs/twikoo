/**
 * GET_COMMENTS_COUNT 事件处理器（1.x getCommentsCount 语义对齐）。
 */
import { NOT, ABSENT } from "../ports/database";
import type { EventHandler } from "../core/types";
import { validate } from "../utils/validate";
import { getUrlsQuery } from "../services/comment-dto";

/**
 * 批量获取文章评论数（includeReply 缺省不含回复；垃圾评论不计入）。
 * @param ctx 请求上下文
 * @returns 计数响应（data: [{url, count}]）
 */
export const getCommentsCount: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  try {
    const event = ctx.request.body;
    validate(event, ["urls"]);
    const urls = event.urls as string[];
    const db = ctx.adapters.database;
    const counts = await Promise.all(
      urls.map(async (url) => {
        /** 单页计数：url 多形态 + 非垃圾 +（缺省）顶级 */
        const urlVariants = new Set(getUrlsQuery([url]));
        let count = 0;
        for (const u of urlVariants) {
          const base: Record<string, unknown> = { url: u, isSpam: { [NOT]: true } };
          if (!event.includeReply) base.rid = ABSENT;
          count += await db.countComments(base as never);
        }
        return { url, count };
      }),
    );
    res.data = counts;
  } catch (e) {
    res.message = e instanceof Error ? e.message : String(e);
    return res;
  }
  return res;
};

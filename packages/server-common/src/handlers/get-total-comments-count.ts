/**
 * GET_TOTAL_COMMENTS_COUNT 事件处理器（2.0 新增，#440）。
 *
 * 全站评论总数会暴露站点规模，因此由配置开关 `SHOW_TOTAL_COUNT` 控制，缺省关闭；
 * 计数口径与 GET_COMMENTS_COUNT 一致（垃圾评论不计入，includeReply 缺省不含回复），
 * 只是不加 url 条件。
 */
import { NOT, ABSENT } from "../ports/database";
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";

/**
 * 获取全站评论总数（SHOW_TOTAL_COUNT 未开启时返回 FAIL，不带 data）。
 * @param ctx 请求上下文
 * @returns 计数响应（data: 评论总数）
 */
export const getTotalCommentsCount: EventHandler = async (ctx) => {
  if (ctx.config.SHOW_TOTAL_COUNT !== "true") {
    return { code: RES_CODE.FAIL, message: "全站评论总数接口未开启" };
  }
  /** 查询条件：非垃圾 +（缺省）顶级 */
  const query: Record<string, unknown> = { isSpam: { [NOT]: true } };
  if (!ctx.request.body.includeReply) query.rid = ABSENT;
  const count = await ctx.adapters.database.countComments(query as never);
  return { code: RES_CODE.SUCCESS, data: count };
};

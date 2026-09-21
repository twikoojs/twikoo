/**
 * COUNTER_GET 事件处理器（1.x counterGet 语义对齐：读取阅读数并自增）。
 */
import type { EventHandler } from "../core/types";
import type { CounterDoc } from "../ports/database";
import { getUrlQuery } from "../services/comment-dto";
import { validate } from "../utils/validate";

/**
 * 获取文章点击量（读取 + 自增一次）。
 *
 * 阅读数按「同一页面的不同 URL 形态」合并统计：`/path` 与 `/path/` 指向同一页面，
 * 读取时把两种形态的计数相加 —— 存量数据可能分散在两个键上（1.x 起就存在该问题），
 * 只查一个键会显示成两个不同的页面。自增仍写在客户端实际请求的那个 URL 上，
 * 与评论侧 `getUrlQuery` 的 `$in` 查询语义保持一致。
 * @param ctx 请求上下文
 * @returns 计数响应（data/time/updated）
 */
export const counterGet: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  try {
    const event = ctx.request.body;
    validate(event, ["url"]);
    const url = event.url as string;
    // 读取：合并 /path 与 /path/ 两种形态（getUrlQuery 同时返回二者；
    // 根路径 "/" 的变体是空串，需过滤掉，避免查一个无意义的空键）
    const variants = getUrlQuery(url).filter((v) => v);
    const records = await Promise.all(variants.map((v) => ctx.adapters.database.getCounter(v)));
    const found = records.filter((r): r is CounterDoc => Boolean(r));
    const time = found.reduce((sum, r) => sum + (r.time ?? 0), 0);
    // data 取计数最大的那条为底（保留 title 等元信息），time 用合并后的总数
    const base = found.reduce<CounterDoc | null>(
      (best, r) => (best === null || (r.time ?? 0) > (best.time ?? 0) ? r : best),
      null,
    );
    res.data = base ? { ...base, time } : {};
    res.time = time;
    const updated = await ctx.adapters.database.incCounter(url, event.title as string | undefined);
    res.updated = 1;
    void updated;
  } catch (e) {
    res.message = e instanceof Error ? e.message : String(e);
    return res;
  }
  return res;
};

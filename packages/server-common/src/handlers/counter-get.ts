/**
 * COUNTER_GET 事件处理器（1.x counterGet 语义对齐：读取阅读数并自增）。
 */
import type { EventHandler } from "../core/types";
import { validate } from "../utils/validate";

/**
 * 获取文章点击量（读取 + 自增一次）。
 * @param ctx 请求上下文
 * @returns 计数响应（data/time/updated）
 */
export const counterGet: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  try {
    const event = ctx.request.body;
    validate(event, ["url"]);
    const record = await ctx.adapters.database.getCounter(event.url as string);
    res.data = record ?? {};
    res.time = record ? record.time : 0;
    const updated = await ctx.adapters.database.incCounter(
      event.url as string,
      event.title as string | undefined,
    );
    res.updated = 1;
    void updated;
  } catch (e) {
    res.message = e instanceof Error ? e.message : String(e);
    return res;
  }
  return res;
};

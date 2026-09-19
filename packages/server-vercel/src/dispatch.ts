/**
 * Vercel 的 POST_SUBMIT 派发实现（规范「后置副作用异步语义」）。
 *
 * **1.x 语义对齐**：COMMENT_SUBMIT 保存评论后，用 **HTTP 递归自调用**把
 * POST_SUBMIT 送到另一个函数实例执行——垃圾检测与邮件/IM 通知因此拥有
 * 独立的执行时间预算，既不会拖慢用户请求，也不会因为用户请求的超时上限
 * 而整条失败（1.x 实现见 `src/server/vercel/api/index.js` 的 `commentSubmit`）。
 *
 * **为什么放在适配器**：这是平台专有机制，common 不应感知。平台相关部分只有
 * 两处：
 * - 自身地址：`TWIKOO_SELF_URL`（显式覆写）→ `VERCEL_URL`（平台注入）；
 * - 内部派发令牌：走 `x-twikoo-recursion` 请求头（1.x 同名，跨版本可互认）。
 *
 * 副作用链本身仍在 common 的 postSubmit 服务里。
 */
import {
  RECURSION_HEADER,
  getAxios,
  getRecursionToken,
  type PostSubmitDispatcher,
} from "@twikoojs/common";

/**
 * 派发等待上限（毫秒）。1.x 为 `Promise.race` 5 秒：超时只表示「本请求不再
 * 继续等」，被调用的实例仍在自己的预算内跑完副作用。
 */
const DISPATCH_TIMEOUT_MS = 5000;

/**
 * 解析自身函数地址（显式覆写优先，其次平台注入的 VERCEL_URL）。
 * @returns 绝对地址；两者皆缺失时为空串
 */
function resolveSelfUrl(): string {
  const explicit = process.env.TWIKOO_SELF_URL;
  if (explicit) return explicit;
  const vercelUrl = process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : "";
}

/** Vercel 的 POST_SUBMIT 派发实现（HTTP 递归自调用） */
export const vercelPostSubmitDispatcher: PostSubmitDispatcher = {
  /**
   * 自调用本函数执行 POST_SUBMIT（不等待副作用完成，只等有界竞速）。
   * @param comment 已入库的评论
   * @param ctx 当前请求上下文（用于取递归令牌与记录日志）
   */
  async dispatch(comment, ctx): Promise<void> {
    const url = resolveSelfUrl();
    if (!url) {
      ctx.logger.warn("POST_SUBMIT 派发跳过：未取到自身地址（TWIKOO_SELF_URL / VERCEL_URL）");
      return;
    }
    const axios = await getAxios();
    await Promise.race([
      axios.post(
        url,
        { event: "POST_SUBMIT", comment },
        { headers: { [RECURSION_HEADER]: getRecursionToken(ctx.config) } },
      ),
      new Promise((resolve) => setTimeout(resolve, DISPATCH_TIMEOUT_MS)),
    ]);
  },
};

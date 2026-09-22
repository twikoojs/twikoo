/**
 * Netlify 的 POST_SUBMIT 派发实现（规范「后置副作用异步语义」）。
 *
 * **与 1.x 的差异（修正）**：1.x 的 Netlify 适配器是 `require('twikoo-vercel')`
 * 纯转发壳，于是继承了 vercel 的 HTTP 递归——而 vercel 取的是 `VERCEL_URL`，
 * 在 Netlify 上并不存在，自调用实际发不出去（副作用静默丢失）。2.0 独立实现，
 * 改用 Netlify 运行时可用的 `URL`（见下）。
 *
 * **平台事实**（docs.netlify.com「Environment variables and serverless functions」，
 * 查阅 2026-09-18）：Netlify Functions **运行时**可用的只读变量只有 `URL` /
 * `SITE_NAME` / `SITE_ID`；`DEPLOY_URL` / `DEPLOY_PRIME_URL` 仅构建期可用。
 * 函数调用路径为 `/.netlify/functions/<函数名>`。
 *
 * 副作用链本身仍在 common 的 postSubmit 服务里。
 */
import {
  RECURSION_HEADER,
  httpPost,
  getRecursionToken,
  type PostSubmitDispatcher,
} from "@twikoojs/common";

/** 派发等待上限（毫秒），语义同 Vercel 实现（超时只表示本请求不再等） */
const DISPATCH_TIMEOUT_MS = 5000;

/** Netlify Functions 的标准调用路径前缀（函数名为 twikoo） */
const FUNCTION_PATH = "/.netlify/functions/twikoo";

/**
 * 解析自身函数地址：`TWIKOO_SELF_URL`（完整地址，显式覆写）→
 * `${URL}/.netlify/functions/twikoo`（运行时只读变量）。
 * @returns 绝对地址；URL 缺失时为空串
 */
function resolveSelfUrl(): string {
  const explicit = process.env.TWIKOO_SELF_URL;
  if (explicit) return explicit;
  const siteUrl = process.env.URL;
  return siteUrl ? `${siteUrl.replace(/\/$/, "")}${FUNCTION_PATH}` : "";
}

/** Netlify 的 POST_SUBMIT 派发实现（HTTP 递归自调用） */
export const netlifyPostSubmitDispatcher: PostSubmitDispatcher = {
  /**
   * 自调用本函数执行 POST_SUBMIT（不等待副作用完成，只等有界竞速）。
   * @param comment 已入库的评论
   * @param ctx 当前请求上下文（用于取递归令牌与记录日志）
   */
  async dispatch(comment, ctx): Promise<void> {
    const url = resolveSelfUrl();
    if (!url) {
      ctx.logger.warn("POST_SUBMIT 派发跳过：未取到自身地址（TWIKOO_SELF_URL / URL）");
      return;
    }
    await Promise.race([
      httpPost(
        url,
        { event: "POST_SUBMIT", comment },
        { headers: { [RECURSION_HEADER]: getRecursionToken(ctx.config) } },
      ),
      new Promise((resolve) => setTimeout(resolve, DISPATCH_TIMEOUT_MS)),
    ]);
  },
};

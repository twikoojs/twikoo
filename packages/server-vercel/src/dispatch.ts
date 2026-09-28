/**
 * Vercel 的 POST_SUBMIT 派发实现。
 *
 * HTTP 递归自调用仍让副作用在独立函数实例执行；`waitUntil()` 托管自调用请求，
 * 使 COMMENT_SUBMIT 不再等待垃圾检测与邮件/IM 通知完成。
 */
import { waitUntil } from "@vercel/functions";
import {
  RECURSION_HEADER,
  httpPost,
  getRecursionToken,
  type PostSubmitDispatcher,
} from "@twikoojs/common";

/** waitUntil 不可用时的兼容等待上限（毫秒） */
const DISPATCH_TIMEOUT_MS = 5000;

/** waitUntil 的最小函数面 */
type Defer = (promise: Promise<unknown>) => void | undefined;

/** HTTP POST 的可注入函数面 */
type Post = (
  url: string,
  data?: unknown,
  config?: { headers?: Record<string, string> },
) => Promise<unknown>;

/** dispatcher 工厂的测试与运行时注入项 */
interface VercelDispatcherOptions {
  post?: Post;
  getDefer?: () => Defer | undefined;
  timeoutMs?: number;
}

/** Vercel 请求上下文在 globalThis 上注册的最小结构面 */
interface VercelRequestContextStore {
  get?: () => { waitUntil?: Defer };
}

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

/**
 * 获取当前 Vercel 请求的 waitUntil；旧运行时及离线调用中返回 undefined。
 * @returns 当前请求可用的 waitUntil
 */
function getRuntimeDefer(): Defer | undefined {
  try {
    const symbol = Symbol.for("@vercel/request-context");
    const store = (globalThis as typeof globalThis & Record<symbol, VercelRequestContextStore>)[
      symbol
    ];
    return typeof store?.get?.().waitUntil === "function" ? waitUntil : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 创建 Vercel POST_SUBMIT 派发器。
 * @param options 平台能力与测试注入项
 * @returns Vercel 派发端口实现
 */
export function createVercelPostSubmitDispatcher(
  options: VercelDispatcherOptions = {},
): PostSubmitDispatcher {
  const post = options.post ?? httpPost;
  const getDefer = options.getDefer ?? getRuntimeDefer;
  const timeoutMs = options.timeoutMs ?? DISPATCH_TIMEOUT_MS;
  return {
    /**
     * HTTP 自调用执行 POST_SUBMIT，并交由 Vercel waitUntil 托管。
     * @param comment 已入库的评论
     * @param ctx 当前请求上下文
     */
    async dispatch(comment, ctx): Promise<void> {
      const url = resolveSelfUrl();
      if (!url) {
        ctx.logger.warn("POST_SUBMIT 派发跳过：未取到自身地址（TWIKOO_SELF_URL / VERCEL_URL）");
        return;
      }
      const running = Promise.resolve().then(() =>
        post(
          url,
          { event: "POST_SUBMIT", comment },
          { headers: { [RECURSION_HEADER]: getRecursionToken(ctx.config) } },
        ),
      );
      const defer = getDefer();
      if (defer) {
        try {
          defer(
            running.catch((error: unknown) => {
              ctx.logger.error(
                "POST_SUBMIT 后台派发失败",
                error instanceof Error ? error.message : String(error),
              );
            }),
          );
          return;
        } catch {
          // 旧运行时或非 Vercel 宿主不支持 waitUntil，继续走兼容等待。
        }
      }
      await Promise.race([running, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    },
  };
}

/** Vercel 的默认 POST_SUBMIT 派发实现 */
export const vercelPostSubmitDispatcher = createVercelPostSubmitDispatcher();

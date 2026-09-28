/**
 * Netlify 的 POST_SUBMIT 派发实现。
 *
 * 现代 Netlify Functions 使用 `context.waitUntil()` 托管 HTTP 自调用，使评论请求
 * 可以先返回；旧 `exports.handler` 入口取不到现代上下文时，继续保留 5 秒有界等待，
 * 避免存量部署升级依赖后丢失通知。
 */
import { getContext } from "@netlify/functions";
import {
  RECURSION_HEADER,
  httpPost,
  getRecursionToken,
  type PostSubmitDispatcher,
} from "@twikoojs/common";

/** 派发等待上限（毫秒），仅用于不支持 waitUntil 的旧入口 */
const DISPATCH_TIMEOUT_MS = 5000;

/** Netlify Functions 的标准调用路径前缀（函数名为 twikoo） */
const FUNCTION_PATH = "/.netlify/functions/twikoo";

/** waitUntil 的最小函数面 */
type WaitUntil = (promise: Promise<unknown>) => void;

/** HTTP POST 的可注入函数面 */
type Post = (
  url: string,
  data?: unknown,
  config?: { headers?: Record<string, string> },
) => Promise<unknown>;

/** dispatcher 工厂的测试与运行时注入项 */
interface NetlifyDispatcherOptions {
  post?: Post;
  getWaitUntil?: () => WaitUntil | undefined;
  timeoutMs?: number;
}

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

/**
 * 获取当前现代 Netlify 请求的 waitUntil；旧入口及离线调用中返回 undefined。
 * @returns 当前请求绑定的 waitUntil
 */
function getRuntimeWaitUntil(): WaitUntil | undefined {
  try {
    const context = getContext();
    return context.waitUntil.bind(context);
  } catch {
    return undefined;
  }
}

/**
 * 创建 Netlify POST_SUBMIT 派发器。
 * @param options 平台能力与测试注入项
 * @returns Netlify 派发端口实现
 */
export function createNetlifyPostSubmitDispatcher(
  options: NetlifyDispatcherOptions = {},
): PostSubmitDispatcher {
  const post = options.post ?? httpPost;
  const getWaitUntil = options.getWaitUntil ?? getRuntimeWaitUntil;
  const timeoutMs = options.timeoutMs ?? DISPATCH_TIMEOUT_MS;
  return {
    /**
     * HTTP 自调用执行 POST_SUBMIT；现代入口立即返回，旧入口保留有界等待。
     * @param comment 已入库的评论
     * @param ctx 当前请求上下文
     */
    async dispatch(comment, ctx): Promise<void> {
      const url = resolveSelfUrl();
      if (!url) {
        ctx.logger.warn("POST_SUBMIT 派发跳过：未取到自身地址（TWIKOO_SELF_URL / URL）");
        return;
      }
      const running = Promise.resolve().then(() =>
        post(
          url,
          { event: "POST_SUBMIT", comment },
          { headers: { [RECURSION_HEADER]: getRecursionToken(ctx.config) } },
        ),
      );
      const waitUntil = getWaitUntil();
      if (waitUntil) {
        try {
          waitUntil(
            running.catch((error: unknown) => {
              ctx.logger.error(
                "POST_SUBMIT 后台派发失败",
                error instanceof Error ? error.message : String(error),
              );
            }),
          );
          return;
        } catch {
          // 上下文不完整时保留旧入口的兼容等待，避免静默丢失通知。
        }
      }
      await Promise.race([running, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    },
  };
}

/** Netlify 的默认 POST_SUBMIT 派发实现 */
export const netlifyPostSubmitDispatcher = createNetlifyPostSubmitDispatcher();

import {
  defineCapabilities,
  MongoDatabase,
  RECURSION_HEADER,
  RES_CODE,
  createHandler,
  getRecursionToken,
  scaffoldAdapters,
  type Database,
  type TkRequest,
  type TkResponse,
  type PostSubmitDispatcher,
} from "@twikoojs/common";

export { VERSION } from "./version";

export interface CloudflareWorkersEnv {
  MONGODB_URI?: string;
  MONGODB_DB_NAME?: string;
  [key: string]: unknown;
}

export interface CloudflareWorkersExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

const workersCapabilities = defineCapabilities({
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: false,
  qqAvatar: true,
  ai: true,
});

/**
 * 归一化请求头。
 * @param headers 平台请求头
 * @returns 全部小写的字符串请求头
 */
function normalizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

/**
 * 请求体转为统一对象。
 * @param body 已解析的请求体
 * @returns Twikoo 请求体；非法形态按空体处理
 */
function normalizeBody(body: unknown): TkRequest["body"] {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as TkRequest["body"])
    : ({} as TkRequest["body"]);
}

/**
 * Cloudflare 请求 → 内部统一请求。
 * @param request Workers 原生请求
 * @param body 已解析的 JSON 请求体
 * @returns 内部统一请求
 */
export function toTkRequest(request: Request, body: unknown = {}): TkRequest {
  const headers = normalizeHeaders(request.headers);
  const forwarded = headers["x-forwarded-for"];
  const url = new URL(request.url);
  const ip =
    headers["cf-connecting-ip"] ??
    headers["x-real-ip"] ??
    (forwarded ? forwarded.split(",")[0].trim() : "") ??
    "";
  return {
    method: String(request.method || "POST").toUpperCase(),
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body: normalizeBody(body),
    headers,
    ip,
    raw: request,
  };
}

/**
 * 内部统一响应 → Workers Response。
 * @param response 内部统一响应
 * @returns Workers 原生响应
 */
export function fromTkResponse(response: TkResponse): Response {
  const headers = new Headers(response.headers);
  if (response.status !== 204 && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(response.status === 204 ? null : JSON.stringify(response.body), {
    status: response.status,
    headers,
  });
}

/**
 * 创建 Workers 的 POST_SUBMIT 递归派发器。
 * @param request 当前请求，用于定位同一个 Worker URL
 * @param executionContext Workers 执行上下文
 * @returns 后置副作用派发器
 */
export function createCloudflareWorkersDispatcher(
  request: Request,
  executionContext?: CloudflareWorkersExecutionContextLike,
): PostSubmitDispatcher {
  return {
    dispatch(comment, ctx): Promise<void> {
      const task = fetch(request.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [RECURSION_HEADER]: getRecursionToken(ctx.config),
        },
        body: JSON.stringify({ event: "POST_SUBMIT", comment }),
      })
        .then((response) => {
          if (!response.ok) throw new Error(`POST_SUBMIT 响应 ${response.status}`);
        })
        .catch((error: unknown) => {
          ctx.logger.error("POST_SUBMIT 失败", error instanceof Error ? error.message : String(error));
        });
      if (executionContext) executionContext.waitUntil(task);
      else void task;
      return Promise.resolve();
    },
  };
}

export interface CloudflareWorkersOptions {
  database?: Database;
  mongoUri?: string;
  mongoDbName?: string;
}

/**
 * 创建 Cloudflare Workers fetch 处理器。
 * @param options 适配器选项
 * @returns `(request, env, executionContext) => Promise<Response>`
 */
export function createCloudflareWorkersFunc(
  options: CloudflareWorkersOptions = {},
): (
  request: Request,
  env?: CloudflareWorkersEnv,
  executionContext?: CloudflareWorkersExecutionContextLike,
) => Promise<Response> {
  return async (request, env = {}, executionContext) => {
    const database =
      options.database ??
      new MongoDatabase({
        uri: options.mongoUri ?? env.MONGODB_URI ?? "",
        dbName: options.mongoDbName ?? env.MONGODB_DB_NAME,
      });
    try {
      let body: unknown = {};
      try {
        const parsed = await request.json();
        body = parsed;
      } catch {
      }
      const tkRequest = toTkRequest(request, body);
      const handler = createHandler(
        scaffoldAdapters({
          request: { toTkRequest: () => tkRequest },
          response: { fromTkResponse: (response: TkResponse) => response },
          database,
          capabilities: workersCapabilities,
          postSubmit: createCloudflareWorkersDispatcher(request, executionContext),
        }),
      );
      return fromTkResponse(await handler(tkRequest));
    } catch (error) {
      return new Response(
        JSON.stringify({
          code: RES_CODE.FAIL,
          message: error instanceof Error ? error.message : String(error),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } finally {
      try {
        await database.close?.();
      } catch {
      }
    }
  };
}

const defaultWorkersFunc = createCloudflareWorkersFunc();

const worker = {
  /**
   * Cloudflare Workers 默认模块入口。
   * @param request Workers 原生请求
   * @param env Workers 环境绑定
   * @param executionContext Workers 执行上下文
   * @returns HTTP 响应
   */
  fetch(
    request: Request,
    env?: CloudflareWorkersEnv,
    executionContext?: CloudflareWorkersExecutionContextLike,
  ): Promise<Response> {
    return defaultWorkersFunc(request, env, executionContext);
  },
};

export default worker;

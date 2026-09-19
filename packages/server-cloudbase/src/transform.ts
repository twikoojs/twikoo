/**
 * CloudBase 载荷转换（事件 ↔ 内部统一请求/响应）。
 *
 * 从 `main.ts` 抽出：入口只负责 SDK 懒加载与端口装配，平台载荷的形状知识
 * （含 IP 解析优先级）集中在本文件。
 */
import type { TkRequest, TkResponse } from "@twikoojs/common";
import type { TcbContextLike } from "./types";

/**
 * 取平台注入的上下文环境变量。
 *
 * 与 `@cloudbase/node-sdk` 的 `getCloudbaseContext()` 同源：该函数从
 * `context.environment` / `context.environ` 与 `process.env` 中按
 * `TCB_CONTEXT_KEYS` 列表取值。
 * @param context 云函数调用上下文
 * @returns 上下文环境变量（无则为空对象）
 */
function contextEnvOf(context?: TcbContextLike): Record<string, string> {
  return context?.environment ?? context?.environ ?? {};
}

/**
 * CloudBase 事件 → 内部统一请求（1.x 语义：事件本身即请求体）。
 *
 * **IP 解析优先级**（1.x `auth.getClientIP()` 直接读平台注入的 `TCB_SOURCE_IP`，
 * 即 CloudBase 云函数的权威来源）：
 * 1. `TCB_SOURCE_IP`——上下文环境变量，`process.env` 兜底；
 * 2. `x-real-ip` 请求头（HTTP 访问服务场景）；
 * 3. `x-forwarded-for` 首跳；
 * 4. `event.requestContext.http.sourceIp`。
 *
 * ⚠️ 本链必须用 `||` 而非 `??`：链上各中间项都是字符串，**空串不是 nullish**。
 * 曾写成 `a ?? (cond ? v : "") ?? b`——中间项在条件不成立时求值为 `""`，
 * 把后面的来源全部短路掉，使 `sourceIp` 成为永远取不到的死代码。
 *
 * @param event 云函数事件
 * @param context 云函数调用上下文（取 TCB_SOURCE_IP）
 * @returns 内部统一请求
 */
export function toTkRequest(event: unknown, context?: TcbContextLike): TkRequest {
  const raw = (event && typeof event === "object" ? event : {}) as Record<string, unknown>;
  const headers = (raw.headers ?? {}) as Record<string, string>;
  const lowerHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    lowerHeaders[key.toLowerCase()] = String(value);
  }
  const tcbSourceIp = contextEnvOf(context).TCB_SOURCE_IP ?? process.env.TCB_SOURCE_IP ?? "";
  const forwarded = lowerHeaders["x-forwarded-for"];
  const forwardedIp = forwarded ? forwarded.split(",")[0].trim() : "";
  const sourceIp = (raw.requestContext as { http?: { sourceIp?: string } } | undefined)?.http
    ?.sourceIp;
  const ip = tcbSourceIp || lowerHeaders["x-real-ip"] || forwardedIp || sourceIp || "";
  // 事件本身即请求体（1.x 语义）
  const body = raw as TkRequest["body"];
  return { method: "POST", path: "/", query: {}, body, headers: lowerHeaders, ip, raw: event };
}

/**
 * 内部统一响应 → 云函数返回体（网关层承载状态码/CORS）。
 * @param response 内部统一响应
 * @returns 云函数返回体
 */
export function fromTkResponse(response: TkResponse): Record<string, unknown> {
  return response.body;
}

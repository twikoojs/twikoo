/**
 * fetch 替身（邮件通路测试共用）。
 *
 * 捕获每次调用的地址、请求头与已解析的请求体，响应由用例注入的 responder 决定。
 */
import { afterEach } from "vitest";

/** 一次 fetch 调用记录 */
export interface FetchCall {
  /** 请求地址 */
  url: string;
  /** 请求头 */
  headers: Record<string, string>;
  /** 已解析的请求体 */
  body: Record<string, unknown>;
}

/** 响应生成函数 */
export type FetchResponder = (call: FetchCall) => { status: number; json: unknown };

/** 原始 fetch（用例结束还原） */
const originalFetch = globalThis.fetch;

/** 当前 responder */
let responder: FetchResponder = () => ({ status: 200, json: { ok: true } });

/** 累计调用 */
let calls: FetchCall[] = [];

/**
 * 安装 fetch 替身（用例结束自动还原）。
 * @param fn 响应生成函数
 */
export function useFakeFetch(fn: FetchResponder): void {
  responder = fn;
  calls = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const call: FetchCall = {
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body,
    };
    calls.push(call);
    const result = responder(call);
    return new Response(JSON.stringify(result.json), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

/**
 * 取累计的 fetch 调用。
 * @returns 调用列表
 */
export function fetchCalls(): FetchCall[] {
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

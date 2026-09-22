/**
 * HTTP 客户端测试（原生 fetch，零依赖）。
 *
 * 用例随代码从 `lib-loader.test.ts` 迁来：原先这两条夹在「库加载器」的测试里，
 * 容易让人误以为 HTTP 请求也走能力门 / 动态加载——它其实直接用运行时的 `fetch`。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { httpPost } from "../../src/utils/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP 客户端", () => {
  it("httpPost：JSON 解析返回 data/status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const res = await httpPost<{ ok: boolean }>("https://x.test/api", { a: 1 });
    expect(res.data.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("httpPost：非 2xx 抛错并携带 response.status/data（axios 错误形态）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "bad" }), { status: 500 })),
    );
    const error = (await httpPost("https://x.test/api", { a: 1 }).catch(
      (e: unknown) => e,
    )) as Error & { response?: { status: number; data: unknown } };
    expect(error.message).toContain("500");
    expect(error.response?.status).toBe(500);
    expect(error.response?.data).toEqual({ error: "bad" });
  });
});

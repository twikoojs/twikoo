/**
 * HTTP 客户端测试（原生 fetch，零依赖）。
 *
 * 两个 httpPost 用例随代码从 `lib-loader.test.ts` 迁来（原先夹在「库加载器」的
 * 测试里，容易让人误以为 HTTP 请求也走能力门 / 动态加载——它其实直接用运行时的
 * `fetch`）；其余用例锁 axios 迁移时实测对齐的行为（params 序列化、载荷归一）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { httpGet, httpPost, httpPut } from "../../src/utils/http";

/** 一次请求的捕获（url / init） */
type CapturedCall = { url: string; init: RequestInit };

/**
 * 安装 fetch 替身。
 * @param body 响应体（JSON 序列化后返回）
 * @param status 响应状态码
 * @returns 调用捕获列表
 */
function useFakeFetch(body: unknown = { ok: true }, status = 200): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP 客户端", () => {
  it("httpPost：对象体 JSON 序列化并补 application/json，响应解析出 data/status", async () => {
    const calls = useFakeFetch({ ok: true });
    const res = await httpPost<{ ok: boolean }>("https://x.test/api", { a: 1 });
    expect(res.data.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe(JSON.stringify({ a: 1 }));
    expect((calls[0]?.init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("httpPost：非 2xx 抛错并携带 response.status/data（axios 错误形态）", async () => {
    useFakeFetch({ error: "bad" }, 500);
    const error = (await httpPost("https://x.test/api", { a: 1 }).catch(
      (e: unknown) => e,
    )) as Error & { response?: { status: number; data: unknown } };
    expect(error.message).toContain("500");
    expect(error.response?.status).toBe(500);
    expect(error.response?.data).toEqual({ error: "bad" });
  });

  it("httpGet：params 拼进 query——丢弃 undefined、保留空串、已有 query 用 & 追加", async () => {
    const calls = useFakeFetch();
    // undefined 值类型上不允许，但实现做了过滤（防御调用方动态拼参）——断言这层容错
    const params = { a: "1", b: "", c: undefined } as unknown as Record<string, string>;
    await httpGet("https://x.test/api", { params });
    expect(calls[0]?.url).toBe("https://x.test/api?a=1&b=");
    await httpGet("https://x.test/api?k=v", { params: { a: "1" } });
    expect(calls[1]?.url).toBe("https://x.test/api?k=v&a=1");
  });

  it("httpGet：URLSearchParams 形态的 params 同样支持（bark 的用法）", async () => {
    const calls = useFakeFetch();
    await httpGet("https://x.test/api", { params: new URLSearchParams({ url: "/p/1" }) });
    expect(calls[0]?.url).toBe("https://x.test/api?url=%2Fp%2F1");
  });

  it("httpPut：方法为 PUT（S3 图床上传用）", async () => {
    const calls = useFakeFetch();
    await httpPut("https://s3.test/bucket/x.png", Buffer.from("img"));
    expect(calls[0]?.init.method).toBe("PUT");
  });

  it("字符串体原样发送，不覆写调用方指定的 Content-Type", async () => {
    const calls = useFakeFetch();
    await httpPost("https://x.test/form", "a=1&b=2", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(calls[0]?.init.body).toBe("a=1&b=2");
    expect((calls[0]?.init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("FormData 形态载荷（有 getBuffer/getHeaders）转 Buffer 并补 multipart 头", async () => {
    const calls = useFakeFetch();
    const formData = {
      getBuffer: () => Buffer.from("binary"),
      getHeaders: () => ({ "content-type": "multipart/form-data" }),
    };
    await httpPost("https://x.test/upload", formData);
    expect(calls[0]?.init.body).toEqual(Buffer.from("binary"));
    expect(calls[0]?.init.headers).toMatchObject({ "content-type": "multipart/form-data" });
  });

  it("timeout 下发 AbortSignal", async () => {
    const calls = useFakeFetch();
    await httpGet("https://x.test/api", { timeout: 5000 });
    expect((calls[0]?.init as { signal?: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
  });

  it("非 JSON 响应保持文本形态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("plain text", { status: 200 })),
    );
    const res = await httpGet<string>("https://x.test/text");
    expect(res.data).toBe("plain text");
  });
});

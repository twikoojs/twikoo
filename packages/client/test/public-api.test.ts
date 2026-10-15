/**
 * twikoo 客户端公开 API 测试。
 *
 * 公开 API 五个（init/getCommentsCount/getRecentComments/getVisitorsCount/version）
 * version 来自 @twikoojs/shared（构建注入）。HTTP 通道以 fetch 替身驱动（happy-dom）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import init, { getCommentsCount, getRecentComments, getVisitorsCount, version } from "../src/main";
import { call, setAppState } from "../src/utils/api";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setAppState(null, {});
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("twikoo 公开 API", () => {
  it("version 来自 @twikoojs/shared（构建注入，运行时为字符串）", () => {
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("公开 API 五件套均为函数", () => {
    expect(typeof init).toBe("function");
    expect(typeof getCommentsCount).toBe("function");
    expect(typeof getRecentComments).toBe("function");
    expect(typeof getVisitorsCount).toBe("function");
  });

  it("urls 未提供 → 先报「urls 参数有误」（1.x getCommentsCountApi 校验顺序）", async () => {
    await expect(getCommentsCount({})).rejects.toThrow(/urls 参数有误/);
  });

  it("缺少 envId 配置 → 报错（1.x 语义）", async () => {
    await expect(getCommentsCount({ urls: ["/a"] })).rejects.toThrow(/缺少 envId 配置/);
  });
});

describe.each(["HTTP", "tcb"])("%s 公共 API 业务响应", (channel) => {
  /** 为两种通道提供相同业务响应，云开发保留 result 信封。 */
  function mockResponse(result: Record<string, unknown>): void {
    if (channel === "HTTP") {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(result)));
    } else {
      setAppState({ app: { callFunction: vi.fn().mockResolvedValue({ result }) } }, {});
    }
  }

  it.each([getCommentsCount, getRecentComments, getVisitorsCount])(
    "%s 遇到非零业务码时拒绝 Promise 并保留原因",
    async (api) => {
      mockResponse({ code: 1000, message: "请求被拒绝" });
      await expect(api({ envId: "https://backend.test", urls: ["/a"] })).rejects.toMatchObject({
        name: "TwikooResponseError",
        message: "请求被拒绝",
      });
    },
  );

  it.each([getCommentsCount, getRecentComments])("%s 成功时保留空数组", async (api) => {
    mockResponse({ code: 0, data: [] });
    await expect(api({ envId: "https://backend.test", urls: ["/a"] })).resolves.toEqual([]);
  });

  it("最新评论成功时保留内容和相对时间", async () => {
    mockResponse({ code: 0, data: [{ id: "c1", created: Date.now(), comment: "hello" }] });
    await expect(getRecentComments({ envId: "https://backend.test" })).resolves.toEqual([
      expect.objectContaining({ id: "c1", comment: "hello", relativeTime: expect.any(String) }),
    ]);
  });

  it("访问量成功时保留完整响应对象", async () => {
    mockResponse({ code: 0, time: 12 });
    await expect(getVisitorsCount({ envId: "https://backend.test" })).resolves.toEqual({
      code: 0,
      time: 12,
    });
  });
});

describe("HTTP 通信层", () => {
  /** fetch 替身：返回指定状态与原始响应体。 */
  function mockFetch(text: string, status = 200) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(text, { status }));
  }

  it("200 JSON 响应解析、携带原有 token 并回写新 token", async () => {
    localStorage.setItem("twikoo-access-token", "old-token");
    const request = mockFetch(
      JSON.stringify({
        code: 0,
        accessToken: "tok-1",
        data: [{ url: "/a", count: 3 }],
      }),
    );
    const result = await getCommentsCount({ envId: "https://backend.test", urls: ["/a"] });
    expect(result).toEqual([{ url: "/a", count: 3 }]);
    expect(localStorage.getItem("twikoo-access-token")).toBe("tok-1");
    expect(request).toHaveBeenCalledWith("https://backend.test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(request.mock.calls[0][1]?.body as string)).toEqual({
      accessToken: "old-token",
      event: "GET_COMMENTS_COUNT",
      urls: ["/a"],
      envId: "https://backend.test",
    });
  });

  it.each([
    [401, "CLIENT_ERROR", "认证失败，请重新登录"],
    [403, "CLIENT_ERROR", "认证失败，请重新登录"],
    [404, "NOT_FOUND", "接口地址不存在"],
    [429, "REJECTED", "请求过于频繁"],
    [500, "SERVER_ERROR", "后端异常"],
    [503, "SERVER_ERROR", "后端异常"],
    [400, "CLIENT_ERROR", "请求失败（400）"],
    [201, "CLIENT_ERROR", "请求失败（201）"],
  ])("HTTP %s 保留错误分类、消息与原始片段", async (status, kind, message) => {
    const text = "x".repeat(250);
    mockFetch(text, status as number);
    await expect(call(null, "GET_CONFIG", { envId: "https://backend.test" })).rejects.toMatchObject(
      {
        name: "TwikooError",
        kind,
        message,
        httpStatus: status,
        rawMessage: text.slice(0, 200),
      },
    );
  });

  it("网络或跨域失败保留合并提示和原始原因", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(call(null, "GET_CONFIG", { envId: "https://backend.test" })).rejects.toMatchObject(
      {
        kind: "CORS",
        message: "请求被跨域策略拦截或网络不可达",
        rawMessage: "Failed to fetch",
      },
    );
  });

  it("非 JSON 响应体保留 UNKNOWN 与原始片段", async () => {
    mockFetch("<html>not json</html>");
    await expect(
      getCommentsCount({ envId: "https://backend.test", urls: ["/a"] }),
    ).rejects.toMatchObject({
      kind: "UNKNOWN",
      message: "后端返回格式异常",
      rawMessage: "<html>not json</html>",
    });
  });

  it("请求序列化失败保留 NETWORK 分类，且不发起请求", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    const data: Record<string, unknown> = {};
    data.self = data;
    await expect(
      call(null, "SET_CONFIG", { envId: "https://backend.test", config: data }),
    ).rejects.toMatchObject({
      kind: "NETWORK",
      message: "无法连接到后端",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "old-token"],
    ["", "old-token"],
    [42, ""],
  ])("accessToken 为 %s 时保持原有回写规则", async (accessToken, expected) => {
    localStorage.setItem("twikoo-access-token", "old-token");
    mockFetch(JSON.stringify({ code: 0, accessToken }));
    await call(null, "GET_CONFIG", { envId: "https://backend.test" });
    expect(localStorage.getItem("twikoo-access-token")).toBe(expected);
  });

  it("HTTP 成功但业务拒绝时仍返回业务结果，由调用方检查", async () => {
    mockFetch(JSON.stringify({ code: 1000, message: "请先登录" }));
    await expect(
      call(null, "COMMENT_SET_FOR_ADMIN", { envId: "https://backend.test" }),
    ).resolves.toEqual({ code: 1000, message: "请先登录" });
  });

  it.each(["headers", "body"])("等待 %s 超时会主动中止并返回 TIMEOUT", async (phase) => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, options) => {
      signal = options?.signal;
      const pending = new Promise<never>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
      return phase === "headers"
        ? pending
        : Promise.resolve(Object.assign(new Response(), { text: () => pending }));
    });
    const outcome = call(null, "GET_CONFIG", { envId: "https://backend.test" }).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(29999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toMatchObject({ kind: "TIMEOUT", message: "请求超时" });
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("响应体读取失败仍被捕获，并清理超时计时器", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () => Promise.reject(new TypeError("连接中断")),
    } as Response);
    await expect(call(null, "GET_CONFIG", { envId: "https://backend.test" })).rejects.toMatchObject(
      { kind: "CORS", rawMessage: "连接中断" },
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("成功后清理计时器，不会在请求完成后触发中止", async () => {
    vi.useFakeTimers();
    const request = mockFetch('{"code":0}');
    await call(null, "GET_CONFIG", { envId: "https://backend.test" });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30000);
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(false);
  });
});

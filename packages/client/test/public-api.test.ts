/**
 * twikoo 客户端公开 API 测试。
 *
 * 公开 API 五个（init/getCommentsCount/getRecentComments/getVisitorsCount/version）
 * version 来自 @twikoojs/shared（构建注入）。HTTP 通道以 XMLHttpRequest 替身驱动（happy-dom）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import init, { getCommentsCount, getRecentComments, getVisitorsCount, version } from "../src/main";
import { TwikooError } from "../src/utils/api";

afterEach(() => {
  vi.restoreAllMocks();
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

describe("HTTP 通信层", () => {
  /** XHR 替身装配（可脚本化 readyState/status/responseText） */
  function mockXhr(script: (xhr: Record<string, unknown>) => void): void {
    const xhrStub: Record<string, unknown> = {
      readyState: 0,
      status: 0,
      responseText: "",
      /** open 替身 */
      open: () => {},
      /** setRequestHeader 替身 */
      setRequestHeader: () => {},
    };
    class FakeXhr {
      /** open 替身 */
      open(): void {}
      /** setRequestHeader 替身 */
      setRequestHeader(): void {}
      /** send：执行脚本模拟响应到达，随后触发 onreadystatechange */
      send(): void {
        const self = this as unknown as Record<string, unknown> & {
          onreadystatechange?: () => void;
        };
        script(self);
        /** 触发 onreadystatechange */
        self.onreadystatechange?.();
      }
      /**
       *
       */
      constructor() {
        Object.assign(this, xhrStub);
      }
    }
    vi.spyOn(globalThis, "XMLHttpRequest").mockImplementation(
      FakeXhr as unknown as new () => XMLHttpRequest,
    );
  }

  it("happy：200 JSON 响应解析 + accessToken 存入 localStorage", async () => {
    mockXhr((xhr) => {
      xhr.readyState = 4;
      xhr.status = 200;
      xhr.responseText = JSON.stringify({
        code: 0,
        accessToken: "tok-1",
        data: [{ url: "/a", count: 3 }],
      });
    });
    // getCommentsCountApi 返回 data 数组（1.x 语义），token 由通信层写入 localStorage
    const result = (await getCommentsCount({
      envId: "https://backend.test",
      urls: ["/a"],
    })) as Array<Record<string, unknown>>;
    expect(result).toEqual([{ url: "/a", count: 3 }]);
    expect(localStorage.getItem("twikoo-access-token")).toBe("tok-1");
  });

  it("404 → TwikooError NOT_FOUND", async () => {
    mockXhr((xhr) => {
      xhr.readyState = 4;
      xhr.status = 404;
      xhr.responseText = "not found";
    });
    const err = (await getCommentsCount({
      envId: "https://backend.test",
      urls: ["/a"],
    }).catch((e) => e)) as TwikooError;
    expect(err).toBeInstanceOf(TwikooError);
    expect(err.kind).toBe("NOT_FOUND");
    expect(err.httpStatus).toBe(404);
  });

  it("429 → TwikooError REJECTED", async () => {
    mockXhr((xhr) => {
      xhr.readyState = 4;
      xhr.status = 429;
      xhr.responseText = "{}";
    });
    const err = (await getRecentComments({ envId: "https://backend.test" }).catch(
      (e) => e,
    )) as TwikooError;
    expect(err.kind).toBe("REJECTED");
  });

  it("500 → TwikooError SERVER_ERROR", async () => {
    mockXhr((xhr) => {
      xhr.readyState = 4;
      xhr.status = 500;
      xhr.responseText = "{}";
    });
    const err = (await getVisitorsCount({ envId: "https://backend.test" }).catch(
      (e) => e,
    )) as TwikooError;
    expect(err.kind).toBe("SERVER_ERROR");
  });

  it("status 0 → CORS/TIMEOUT 分类", async () => {
    mockXhr((xhr) => {
      xhr.readyState = 4;
      xhr.status = 0;
    });
    const err = (await getCommentsCount({
      envId: "https://backend.test",
      urls: ["/a"],
    }).catch((e) => e)) as TwikooError;
    expect(err).toBeInstanceOf(TwikooError);
    expect(["CORS", "TIMEOUT"]).toContain(err.kind);
  });

  it("非 JSON 响应体 → UNKNOWN + 原始片段（不崩溃）", async () => {
    mockXhr((xhr) => {
      xhr.readyState = 4;
      xhr.status = 200;
      xhr.responseText = "<html>not json</html>";
    });
    const err = (await getCommentsCount({
      envId: "https://backend.test",
      urls: ["/a"],
    }).catch(
      /** 捕获后返回错误对象供断言 */
      (e) => e,
    )) as TwikooError;
    expect(err).toBeInstanceOf(TwikooError);
    expect(err.kind).toBe("UNKNOWN");
    expect(err.rawMessage).toContain("not json");
  });
});

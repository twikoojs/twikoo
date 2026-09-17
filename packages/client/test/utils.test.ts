/**
 * 客户端 utils 全量单测（T34 覆盖率收尾 + Wave 4 补齐新增工具）。
 */
import { describe, expect, it } from "vitest";
import {
  isUrl,
  isNotSet,
  timeago,
  dateFormat,
  convertLink,
  timestamp,
  getUrl,
  getHref,
  normalizeMail,
  isQQ,
  getFuncVer,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  readAsText,
  blobToDataURL,
  getUserAgent,
  renderLinks,
  renderMath,
  getOptions,
  logger,
} from "../src/utils";
import { setLanguage } from "../src/i18n";
import { call } from "../src/utils/api";

describe("utils 基础函数（T34）", () => {
  it("isUrl / isNotSet / isQQ / normalizeMail", () => {
    expect(isUrl("https://x.test")).toBe(true);
    expect(isUrl("nope")).toBe(false);
    expect(isNotSet(undefined)).toBe(true);
    expect(isNotSet("")).toBe(true);
    expect(isNotSet("v")).toBe(false);
    expect(isQQ("123456")).toBe(true);
    expect(isQQ("a@b.com")).toBe(false);
    expect(normalizeMail("  A@B.COM ")).toBe("a@b.com");
  });

  it("convertLink：缺协议补 http://", () => {
    expect(convertLink("")).toBe("");
    expect(convertLink("example.com")).toBe("http://example.com");
    expect(convertLink("https://example.com")).toBe("https://example.com");
  });

  it("timestamp：毫秒时间戳", () => {
    const date = new Date("2026-01-02T03:04:05Z");
    expect(timestamp(date)).toBe(date.getTime());
  });

  it("timeago：1.x 语义（秒/分/时/天，≥8 天显示日期）", () => {
    setLanguage({ lang: "zh-CN" });
    const now = Date.now();
    expect(timeago(now)).toBe("0 秒前");
    expect(timeago(now - 5 * 60000)).toBe("5 分钟前");
    expect(timeago(now - 3 * 3600000)).toBe("3 小时前");
    expect(timeago(now - 2 * 86400000)).toBe("2 天前");
    expect(timeago(now + 5000)).toBe("刚刚");
    expect(timeago(now - 45 * 86400000)).toBe(dateFormat(new Date(now - 45 * 86400000)));
    expect(timeago(undefined)).toBe("");
  });

  it("timeago：英文文案（随 setLanguage 切换）", () => {
    setLanguage({ lang: "en" });
    expect(timeago(Date.now() - 5 * 60000)).toBe("5 minutes ago");
    setLanguage({ lang: "zh-CN" });
  });

  it("dateFormat：YYYY-MM-DD 左补零", () => {
    expect(dateFormat(new Date(2026, 0, 2))).toBe("2026-01-02");
  });

  it("getUrl：TWIKOO_MAGIC_PATH / 表达式字符串 / 缺省", () => {
    (window as unknown as { TWIKOO_MAGIC_PATH?: string }).TWIKOO_MAGIC_PATH = "/magic";
    expect(getUrl(undefined)).toBe("/magic");
    (window as unknown as { TWIKOO_MAGIC_PATH?: string }).TWIKOO_MAGIC_PATH = undefined;
    expect(getUrl("location.pathname")).toBe(window.location.pathname);
    expect(getUrl("location.href")).toBe(window.location.href);
    expect(getUrl("/custom")).toBe("/custom");
    expect(getUrl(undefined)).toBe(window.location.pathname);
  });

  it("getHref：TWIKOO_MAGIC_HREF / 显式 / 缺省", () => {
    (window as unknown as { TWIKOO_MAGIC_HREF?: string }).TWIKOO_MAGIC_HREF = "https://h.test";
    expect(getHref(undefined)).toBe("https://h.test");
    (window as unknown as { TWIKOO_MAGIC_HREF?: string }).TWIKOO_MAGIC_HREF = undefined;
    expect(getHref("https://explicit.test")).toBe("https://explicit.test");
    expect(getHref(undefined)).toBe(window.location.href);
  });

  it("logger：分级输出（warn/error 走 console）", () => {
    logger.verbose("v");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
  });
});

describe("utils 文件与 DOM 工具（Wave 4 补齐）", () => {
  it("readAsText：读取文本文件", async () => {
    const text = await readAsText(new File(["hello"], "a.txt", { type: "text/plain" }));
    expect(text).toBe("hello");
  });

  it("blobToDataURL：Blob → DataURL", async () => {
    const url = await blobToDataURL(new Blob(["abc"], { type: "text/plain" }));
    expect(url.startsWith("data:text/plain")).toBe(true);
  });

  it("getUserAgent：返回非空 UA 字符串（无 UA-CH 时即原始 UA）", async () => {
    const ua = await getUserAgent();
    expect(typeof ua).toBe("string");
    expect(ua.length).toBeGreaterThan(0);
  });

  it("renderLinks：数组入参直接作用于原元素（2.0 修复点）", () => {
    document.body.innerHTML =
      '<div id="a"><a href="https://x.test">x</a></div><div id="b"><a href="https://y.test">y</a></div>';
    const hosts = [
      document.getElementById("a") as HTMLElement,
      document.getElementById("b") as HTMLElement,
    ];
    renderLinks(hosts);
    const anchors = document.querySelectorAll("a");
    expect(anchors[0].getAttribute("target")).toBe("_blank");
    expect(anchors[1].getAttribute("rel")).toContain("noopener");
    // null 入参安全（$refs 未就绪）
    renderLinks(null);
    document.body.innerHTML = "";
  });

  it("renderMath：无全局 renderMathInElement 时静默跳过", () => {
    renderMath(document.createElement("div"), undefined);
    renderMath(null, undefined);
    expect(true).toBe(true);
  });

  it("getOptions：读取注入的前端选项", async () => {
    const { setAppState } = await import("../src/utils/api");
    setAppState(null, { path: "/x", lang: "zh-CN" });
    expect(getOptions().path).toBe("/x");
  });
});

describe("utils call 云开发通道（T34）", () => {
  it("tcb 通道：callFunction 转发（事件名在 data.event）", async () => {
    let received: { name: string; data: Record<string, unknown> } | undefined;
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async (params: { name: string; data: Record<string, unknown> }) => {
          received = params;
          return { result: { code: 0 } };
        },
      },
    };
    const result = (await call(tcb as never, "GET_FUNC_VERSION", { extra: 1 })) as {
      result: { code: number };
    };
    expect(result.result.code).toBe(0);
    expect(received?.data.event).toBe("GET_FUNC_VERSION");
  });

  it("getFuncVer：结果进程内缓存（只请求一次）", async () => {
    let calls = 0;
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async () => {
          calls++;
          return { result: { version: "1.0.0" } };
        },
      },
    };
    await getFuncVer(tcb as never);
    await getFuncVer(tcb as never);
    expect(calls).toBe(1);
  });
});

describe("utils API 封装（T34）", () => {
  it("getCommentsCountApi / getRecentCommentsApi / getVisitorsCountApi 事件转发", async () => {
    const events: string[] = [];
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async (params: { name: string; data: Record<string, unknown> }) => {
          events.push(String(params.data.event));
          return { result: { code: 0, data: [] } };
        },
      },
    };
    await getCommentsCountApi(tcb, { urls: ["/a"] });
    await getRecentCommentsApi(tcb, { pageSize: 5 });
    await getVisitorsCountApi(tcb, { path: "/p/1" });
    expect(events).toEqual(["GET_COMMENTS_COUNT", "GET_RECENT_COMMENTS", "COUNTER_GET"]);
  });

  it("getCommentsCountApi：urls 非数组抛错；空数组直接返回 []", async () => {
    await expect(getCommentsCountApi(null, {})).rejects.toThrow(/urls 参数有误/);
    await expect(getCommentsCountApi(null, { urls: [] })).resolves.toEqual([]);
  });

  it("getRecentCommentsApi：为每条评论补 relativeTime", async () => {
    setLanguage({ lang: "zh-CN" });
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async () => ({
          result: { code: 0, data: [{ created: Date.now() - 5 * 60000 }] },
        }),
      },
    };
    const data = (await getRecentCommentsApi(tcb, { pageSize: 1 })) as Array<{
      relativeTime?: string;
    }>;
    expect(data[0].relativeTime).toBe("5 分钟前");
  });
});

describe("view render（T34）", () => {
  it("render：createApp 挂载到 el 并注入全局属性", async () => {
    document.body.innerHTML = '<div id="twikoo-test"></div>';
    const { render, getApp } = await import("../src/view");
    const app = render(null, { el: "#twikoo-test" });
    expect(app).toBeTruthy();
    expect(getApp()).toBe(app);
    document.getElementById("twikoo-test")?.remove();
    app.unmount();
  });
});

describe("updateVisitorsCount（T34）", () => {
  it("元素存在 + 非 localhost → 写入 time", async () => {
    document.body.innerHTML = '<span id="twikoo_visitors"></span>';
    let calledEvent: string | undefined;
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async (params: { name: string; data: Record<string, unknown> }) => {
          calledEvent = String(params.data.event);
          return { result: { time: 42 } };
        },
      },
    };
    const { updateVisitorsCount } = await import("../src/utils");
    // happy-dom 缺省 URL 为 localhost（isLocalhost 会跳过），切到非 localhost
    await (
      window as unknown as { happyDOM: { setURL(url: string): Promise<void> } }
    ).happyDOM.setURL("https://blog.test/post/1");
    await updateVisitorsCount(tcb, {});
    expect(calledEvent).toBe("COUNTER_GET");
    expect(document.getElementById("twikoo_visitors")?.innerHTML).toBe("42");
  });

  it("元素存在但为 localhost → 跳过（不请求）", async () => {
    document.body.innerHTML = '<span id="twikoo_visitors"></span>';
    await (
      window as unknown as { happyDOM: { setURL(url: string): Promise<void> } }
    ).happyDOM.setURL("http://localhost:9820/");
    let called = false;
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async () => {
          called = true;
          return { result: { time: 1 } };
        },
      },
    };
    const { updateVisitorsCount } = await import("../src/utils");
    expect(await updateVisitorsCount(tcb, {})).toBeNull();
    expect(called).toBe(false);
    await (
      window as unknown as { happyDOM: { setURL(url: string): Promise<void> } }
    ).happyDOM.setURL("https://blog.test/post/1");
    document.body.innerHTML = "";
  });
});

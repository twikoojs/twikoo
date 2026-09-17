/**
 * 客户端 utils 全量单测（T34 覆盖率收尾）。
 */
import { describe, expect, it } from "vitest";
import {
  isUrl,
  isNotSet,
  timeago,
  getUrl,
  getHref,
  normalizeMail,
  isQQ,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
} from "../src/utils";
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

  it("timeago：分钟/小时/天/月/年（中文）", () => {
    const now = Date.now();
    expect(timeago(now, "zh-CN")).toBe("刚刚");
    expect(timeago(now - 5 * 60000, "zh-CN")).toBe("5分钟前");
    expect(timeago(now - 3 * 3600000, "zh-CN")).toBe("3小时前");
    expect(timeago(now - 2 * 86400000, "zh-CN")).toBe("2天前");
    expect(timeago(now - 45 * 86400000, "zh-CN")).toBe("1个月前");
    expect(timeago(now - 400 * 86400000, "zh-CN")).toBe("1年前");
    expect(timeago(now - 5 * 60000, "en")).toBe("5 minutes ago");
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
});

describe("utils call 云开发通道（T34）", () => {
  /** tcb 通道：callFunction 转发（事件名在 data.event） */
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
});

describe("utils API 封装（T34）", () => {
  /** 三 API 事件转发 */
  it("getCommentsCountApi / getRecentCommentsApi / getVisitorsCountApi 事件转发", async () => {
    const events: string[] = [];
    const tcb = {
      app: {
        /**
         *
         */
        callFunction: async (params: { name: string; data: Record<string, unknown> }) => {
          events.push(String(params.data.event));
          return { result: { code: 0 } };
        },
      },
    };
    await getCommentsCountApi(tcb, { urls: ["/a"] });
    await getRecentCommentsApi(tcb, { pageSize: 5 });
    await getVisitorsCountApi(tcb, { path: "/p/1" });
    expect(events).toEqual(["GET_COMMENTS_COUNT", "GET_RECENT_COMMENTS", "COUNTER_GET"]);
  });
});

describe("view render（T34）", () => {
  it("render：createApp 挂载到 el 并注入全局属性", async () => {
    document.body.innerHTML = '<div id="twikoo-test"></div>';
    const { render } = await import("../src/view");
    const app = render(null, { el: "#twikoo-test" });
    expect(app).toBeTruthy();
    document.getElementById("twikoo-test")?.remove();
    app.unmount();
  });
});

describe("updateVisitorsCount（T34）", () => {
  /** 非 localhost 时访问量写入元素 */
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
});

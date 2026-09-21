/**
 * pushoo 各渠道请求体构造单测。
 *
 * mock HTTP（fetch 全局替身，vi.hoisted 捕获）：不真实发请求；逐渠道断言端点
 * URL 与请求体构造（JSON 体与 URLSearchParams 表单体均解码后匹配内容）。
 * 1.x 行为基准：端点与参数名逐一对齐。notice() 对 token 缺失等错误返回
 * `{ error }` 而非未捕获异常。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** fetch 调用捕获（vi.hoisted：vi.stubGlobal 提升后仍可引用） */
const { httpCalls, mockState } = vi.hoisted(() => ({
  httpCalls: [] as Array<{ url: string; body: unknown; method?: string; headers?: unknown }>,
  /** 可控响应状态：用例可改为非 2xx 以断言错误路径 */
  mockState: { status: 200 },
}));

vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
  httpCalls.push({ url, body: init.body, method: init.method, headers: init.headers });
  // onebot 校验 retcode === 0；其余渠道忽略返回体形态
  return new Response(JSON.stringify({ retcode: 0, errno: 0, errmsg: "ok" }), {
    status: mockState.status,
    headers: { "Content-Type": "application/json" },
  });
});

const { notice } = await import("../src/index");

/** 重建捕获（每用例隔离） */
beforeEach(() => {
  httpCalls.length = 0;
  mockState.status = 200;
});

/** 基础载荷 */
const base = { token: "T0KEN", title: "标题", content: "正文内容" };

/**
 * 解码请求体：JSON 直接解析；URLSearchParams 表单体 URL 解码后返回文本。
 * @param body 原始请求体
 * @returns 可断言的文本形态
 */
function bodyText(body: unknown): string {
  if (typeof body !== "string") return JSON.stringify(body ?? "");
  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return decodeURIComponent(body.replace(/\+/g, " "));
  }
}

/** 通道 → 端点断言表（URL 片段 + 请求体内容片段，均为 1.x 行为基准） */
const CHANNELS: Array<{
  channel: string;
  urlContains: string;
  bodyContains: string[];
  /** 渠道专属载荷（复合 token / 扩展 options） */
  payload?: Record<string, unknown>;
  /** URL 解码后的路径断言（bark 等 GET 路径形态） */
  urlContainsDecoded?: string[];
}> = [
  { channel: "qmsg", urlContains: "qmsg.zendee.cn/send/T0KEN", bodyContains: ["正文内容"] },
  { channel: "serverchan", urlContains: "sc.ftqq.com/T0KEN.send", bodyContains: ["正文内容"] },
  { channel: "pushplus", urlContains: "www.pushplus.plus", bodyContains: ["正文内容"] },
  { channel: "dingtalk", urlContains: "oapi.dingtalk.com/robot/send", bodyContains: ["正文内容"] },
  {
    // wecom：token = corpid#corpsecret#agentid（先换 access_token 再发消息）
    channel: "wecom",
    urlContains: "qyapi.weixin.qq.com/cgi-bin/message/send",
    bodyContains: ["正文内容"],
    payload: { token: "corp1#secret1#agent1" },
  },
  {
    // bark：GET 路径形态（title/content 编码后拼在 URL 路径）
    channel: "bark",
    urlContains: "api.day.app/T0KEN/",
    bodyContains: [],
    urlContainsDecoded: ["正文内容"],
  },
  {
    // gocqhttp：token 为完整 HTTP 地址（1.x 语义）
    channel: "gocqhttp",
    urlContains: "https://gocq.test/send_private_msg",
    bodyContains: ["正文内容"],
    payload: { token: "https://gocq.test/send_private_msg?user_id=1" },
  },
  {
    // onebot：token 为完整 HTTP 地址（可带 user_id/group_id 查询参数）
    channel: "onebot",
    urlContains: "https://onebot.test",
    bodyContains: ["正文内容"],
    payload: { token: "https://onebot.test/msg?user_id=1" },
  },
  { channel: "atri", urlContains: "pushoo.tianli0.top", bodyContains: ["T0KEN", "正文内容"] },
  { channel: "pushdeer", urlContains: "api2.pushdeer.com", bodyContains: ["正文内容"] },
  { channel: "igot", urlContains: "T0KEN", bodyContains: ["正文内容"] },
  {
    // telegram：token = botToken#chatId
    channel: "telegram",
    urlContains: "api.telegram.org/botBOT1/sendMessage",
    bodyContains: ["正文内容"],
    payload: { token: "BOT1#CHAT2" },
  },
  {
    channel: "feishu",
    urlContains: "open.feishu.cn/open-apis/bot/v2/hook/T0KEN",
    bodyContains: ["正文内容"],
  },
  {
    // lark：与 feishu 同语义，仅开放平台 base URL 不同
    channel: "lark",
    urlContains: "open.larksuite.com/open-apis/bot/v2/hook/T0KEN",
    bodyContains: ["正文内容"],
  },
  {
    // ifttt：token = eventName#key（1.x 分段语义）
    channel: "ifttt",
    urlContains: "maker.ifttt.com/trigger/EVT1/with/key/KEY1",
    bodyContains: ["标题"],
    payload: { token: "KEY1#EVT1" },
  },
  {
    channel: "wecombot",
    urlContains: "qyapi.weixin.qq.com/cgi-bin/webhook/send",
    bodyContains: ["正文内容"],
  },
  {
    // discord：token 为 webhook 完整地址或 id#/ 分段
    channel: "discord",
    urlContains: "https://discord.com/api/webhooks/1/2",
    bodyContains: ["正文内容"],
    payload: { token: "1#2" },
  },
  {
    // wxpusher：token = appToken#topicIds
    channel: "wxpusher",
    urlContains: "wxpusher.zjiecode.com",
    bodyContains: ["正文内容"],
    payload: { token: "AT1#1,2" },
  },
  {
    // join：token = apiKey#deviceId
    channel: "join",
    urlContains: "joinjoaomgcd.appspot.com",
    bodyContains: ["正文内容"],
    payload: { token: "KEY1#DEV1" },
  },
  {
    // ntfy：token 为 topic 名（公共实例），自建实例可填完整 URL
    channel: "ntfy",
    urlContains: "ntfy.sh/T0PIC",
    bodyContains: ["正文内容"],
    payload: { token: "T0PIC" },
  },
];

describe("pushoo 渠道请求构造", () => {
  for (const { channel, urlContains, bodyContains, payload, urlContainsDecoded } of CHANNELS) {
    it(`渠道 ${channel}：请求发往 ${urlContains.split("?")[0].slice(0, 40)} 且携带内容`, async () => {
      const result = await notice(channel, { ...base, ...payload } as never);
      expect(result.error).toBeUndefined();
      expect(httpCalls.length).toBeGreaterThanOrEqual(1);
      const call = httpCalls[httpCalls.length - 1];
      expect(call.url).toContain(urlContains);
      const text = bodyText(call.body);
      for (const frag of bodyContains) {
        expect(text).toContain(frag);
      }
      for (const frag of urlContainsDecoded ?? []) {
        expect(decodeURIComponent(call.url)).toContain(frag);
      }
    });
  }

  it("serverchan：sct 前缀 token 走 sctapi.ftqq.com（1.x 分流语义）", async () => {
    await notice("serverchan", { ...base, token: "SCT123ABC" } as never);
    expect(httpCalls[httpCalls.length - 1].url).toContain("sctapi.ftqq.com/SCT123ABC.send");
  });

  it("serverchain 与 serverchan 同端点（1.x 别名语义）", async () => {
    await notice("serverchain", base as never);
    expect(httpCalls[httpCalls.length - 1].url).toContain("sc.ftqq.com");
  });

  it("webhook：自定义 URL + POST JSON", async () => {
    await notice("webhook", {
      ...base,
      options: { webhook: { url: "https://hook.test/x" } },
    } as never);
    const call = httpCalls[httpCalls.length - 1];
    expect(call.url).toBe("https://hook.test/x");
    expect(JSON.stringify(call.body)).toContain("正文内容");
  });

  it("URL 通道：https:// 开头的 channel 走 webhook（:GET 后缀切换方法）", async () => {
    await notice("https://my.test/hook:GET", base as never);
    const call = httpCalls[httpCalls.length - 1];
    // fetch 收到的是拼好查询串的最终 URL（旧 axios 替身只记录传入的 url 参数）
    expect(call.url).toContain("https://my.test/hook?");
    expect(decodeURIComponent(call.url)).toContain("content=正文内容");
    expect(call.method).toBe("GET");
  });

  it("ntfy：自建实例填完整 URL，认证与优先级走请求头", async () => {
    await notice("ntfy", {
      ...base,
      token: "https://ntfy.test/my-topic",
      options: {
        ntfy: { accessToken: "tk_test", priority: 5, tags: "warning", click: "https://blog.test" },
      },
    } as never);
    const call = httpCalls[httpCalls.length - 1];
    expect(call.url).toBe("https://ntfy.test/my-topic");
    expect(call.headers).toMatchObject({
      Authorization: "Bearer tk_test",
      Priority: "5",
      Tags: "warning",
      Click: "https://blog.test",
    });
  });

  it("ntfy：非 ASCII 标题按 RFC 2047 编码（HTTP 头部不接受 latin1 以外的字符）", async () => {
    await notice("ntfy", { ...base, token: "T0PIC", title: "标题" } as never);
    const headers = httpCalls[httpCalls.length - 1].headers as Record<string, string>;
    expect(headers.Title).toBe(`=?UTF-8?B?${Buffer.from("标题", "utf8").toString("base64")}?=`);
  });

  it("ntfy：ASCII 标题原样写入 Title 头", async () => {
    await notice("ntfy", { ...base, token: "T0PIC", title: "New comment" } as never);
    const headers = httpCalls[httpCalls.length - 1].headers as Record<string, string>;
    expect(headers.Title).toBe("New comment");
  });
});

describe("原生 fetch 迁移后的请求形态", () => {
  it("非 2xx 抛错 → notice() 返回 { error }（与 axios 一致）", async () => {
    mockState.status = 500;
    const result = await notice("serverchan", base as never);
    expect(result.error).toBeInstanceOf(Error);
    expect(String(result.error?.message)).toContain("500");
  });

  it("GET 参数支持 URLSearchParams 形态（bark 的空串 url 参数不被丢弃）", async () => {
    await notice("bark", { ...base, token: "T0KEN" } as never);
    expect(httpCalls[httpCalls.length - 1].url).toMatch(/\?url=$/);
  });

  it("对象体发 application/json，字符串体发表单编码（对齐 axios 推断）", async () => {
    await notice("dingtalk", base as never);
    const jsonCall = httpCalls[httpCalls.length - 1];
    expect(jsonCall.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(typeof jsonCall.body).toBe("string");

    await notice("gocqhttp", { ...base, token: "https://gocq.test/send_private_msg" } as never);
    const formCall = httpCalls[httpCalls.length - 1];
    expect(formCall.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(decodeURIComponent(String(formCall.body))).toContain("正文内容");
  });
});

describe("pushoo 错误形态", () => {
  it("token 缺失 → 返回 { error } 而非未捕获异常", async () => {
    const result = await notice("serverchan", {
      token: "",
      title: "t",
      content: "c",
    } as never);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("未知渠道 → 返回 { error }（is not supported）", async () => {
    const result = await notice("no-such-channel", base as never);
    expect(String(result.error?.message)).toContain("is not supported");
  });
});

/**
 * 适配器端到端测试（真跑 pipeline + 真 D1 SQL）。
 *
 * 用 `node:sqlite` 撑起 `env.DB`，因此这里验证的是**完整链路**：Worker 入口 →
 * 载荷归一 → 限流 / 校验 / 读配置 / CORS / 分发 → handler → D1 读写 → 响应序列化，
 * 以及 Cloudflare 特有的四件套（xss 消毒垫片、D1 落库、属地回填、waitUntil 派发）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetCustomLibs } from "@twikoojs/common";
import worker, {
  cloudflareCapabilities,
  createCloudflareFunc,
  fromTkResponse,
  toTkRequest,
} from "../src/index";
import type { CloudflareEnvLike, ExecutionContextLike } from "../src/index";
import { D1Database } from "../src/database/d1";
import { resetGeoStore, lookupRegion } from "../src/geo/region-store";
import { createSqliteD1 } from "./utils/sqlite-d1";
import type { SqliteD1 } from "./utils/sqlite-d1";

/** 测试用站点地址 */
const ENDPOINT = "https://twikoo.example.com/";

/**
 * 造一个 Workers 请求（可选注入 `request.cf`——标准 Request 没有该字段，Workers 才有）。
 * @param body 请求体
 * @param options 覆写项
 * @returns 请求对象
 */
function makeRequest(
  body: unknown,
  options: {
    method?: string;
    headers?: Record<string, string>;
    cf?: Record<string, string>;
    ip?: string;
    query?: string;
  } = {},
): Request {
  const method = options.method ?? "POST";
  const hasBody = method !== "OPTIONS" && method !== "GET";
  const request = new Request(`${ENDPOINT}${options.query ?? ""}`, {
    method,
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": options.ip ?? "1.2.3.4",
      ...options.headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  if (options.cf) Object.defineProperty(request, "cf", { value: options.cf, configurable: true });
  return request;
}

/** 解析响应体 */
async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

/** 可注入的 waitUntil 收集器 */
function makeExecutionCtx(): { executionCtx: ExecutionContextLike; pending: Promise<unknown>[] } {
  const pending: Promise<unknown>[] = [];
  return { executionCtx: { waitUntil: (promise) => pending.push(promise) }, pending };
}

/** 建库（可选择预置配置） */
async function bootstrap(config?: Record<string, unknown>): Promise<SqliteD1> {
  const binding = createSqliteD1();
  const db = new D1Database(binding);
  await db.init();
  if (config) await db.saveConfig(config as never);
  return binding;
}

beforeEach(() => {
  resetGeoStore();
  resetCustomLibs();
});

afterEach(() => {
  resetCustomLibs();
});

describe("薄适配器 · 载荷转换", () => {
  it("toTkRequest：请求头小写化、路径与查询参数、IP 取 CF-Connecting-IP", () => {
    const request = makeRequest(
      { event: "GET_FUNC_VERSION" },
      {
        headers: { "X-Custom": "1", origin: "https://blog.example.com" },
        ip: "203.0.113.9",
        query: "?foo=bar&baz=1",
      },
    );
    const tkRequest = toTkRequest({ request, env: {}, body: { event: "GET_FUNC_VERSION" } });
    expect(tkRequest.method).toBe("POST");
    expect(tkRequest.path).toBe("/");
    expect(tkRequest.query).toEqual({ foo: "bar", baz: "1" });
    expect(tkRequest.headers["x-custom"]).toBe("1");
    expect(tkRequest.headers.origin).toBe("https://blog.example.com");
    expect(tkRequest.ip).toBe("203.0.113.9");
    expect(tkRequest.body.event).toBe("GET_FUNC_VERSION");
  });

  it("IP 回落顺序：cf-connecting-ip → x-forwarded-for 首跳 → x-real-ip", () => {
    /** 造一个不带 cf-connecting-ip 的请求（Workers 上少见，但归一逻辑要兜住） */
    const request = (headers: Record<string, string>): Request =>
      new Request(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: "{}",
      });
    expect(
      toTkRequest({
        request: request({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" }),
        env: {},
        body: {} as never,
      }).ip,
    ).toBe("5.6.7.8");
    expect(
      toTkRequest({ request: request({ "x-real-ip": "4.4.4.4" }), env: {}, body: {} as never }).ip,
    ).toBe("4.4.4.4");
    expect(toTkRequest({ request: request({}), env: {}, body: {} as never }).ip).toBe("");
  });

  it("fromTkResponse：状态码与响应头透传；204 无体", async () => {
    const ok = fromTkResponse({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "https://blog.example.com" },
      body: { code: 0 },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://blog.example.com");
    expect(ok.headers.get("Content-Type")).toBe("application/json;charset=UTF-8");
    expect(await bodyOf(ok)).toEqual({ code: 0 });

    const limited = fromTkResponse({ status: 429, headers: {}, body: { code: 1000 } });
    expect(limited.status).toBe(429);

    const preflight = fromTkResponse({
      status: 204,
      headers: { "Access-Control-Max-Age": "600" },
      body: {},
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Max-Age")).toBe("600");
    expect(await preflight.text()).toBe("");
  });
});

describe("薄适配器 · 端到端", () => {
  it("GET_FUNC_VERSION：200 + code 0 + version（默认入口形态）", async () => {
    const binding = await bootstrap();
    const response = await worker.fetch(
      makeRequest({ event: "GET_FUNC_VERSION" }),
      { DB: binding },
      makeExecutionCtx().executionCtx,
    );
    expect(response.status).toBe(200);
    const body = await bodyOf(response);
    expect(body.code).toBe(0);
    expect(typeof body.version).toBe("string");
  });

  it("OPTIONS 预检：204 + CORS（不写库）", async () => {
    const binding = await bootstrap();
    const func = createCloudflareFunc();
    const response = await func(
      makeRequest(
        {},
        {
          method: "OPTIONS",
          headers: { origin: "https://blog.example.com", "access-control-request-method": "POST" },
        },
      ),
      { DB: binding },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://blog.example.com");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("600");
    expect(await response.text()).toBe("");
  });

  it("未绑定 D1：不抛异常，返回可读的业务失败体（1.x 语义：异常不外抛）", async () => {
    const func = createCloudflareFunc();
    const response = await func(makeRequest({ event: "GET_FUNC_VERSION" }), {});
    expect(response.status).toBe(200);
    const body = await bodyOf(response);
    expect(body.code).toBe(1000);
    expect(String(body.message)).toContain("未绑定 D1 数据库");
    expect(String(body.message)).toContain("wrangler.toml");
  });

  it("COMMENT_SUBMIT → COMMENT_GET：xss 消毒、属地与 IP 落库、waitUntil 派发副作用", async () => {
    const binding = await bootstrap({ SHOW_REGION: "true" });
    const func = createCloudflareFunc();
    const { executionCtx, pending } = makeExecutionCtx();
    const env: CloudflareEnvLike = { DB: binding };

    const submitResponse = await func(
      makeRequest(
        {
          event: "COMMENT_SUBMIT",
          url: "/post/1",
          href: "https://blog.example.com/post/1",
          ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          nick: "云上访客",
          mail: "guest@example.com",
          comment: '<p>你好</p><script>alert(1)</script><img src=x onerror=alert(1)>',
        },
        { cf: { country: "CN", region: "广东省", city: "深圳市" }, ip: "1.2.3.4" },
      ),
      env,
      executionCtx,
    );
    const submitted = await bodyOf(submitResponse);
    expect(submitted.code).toBe(0);
    expect(typeof submitted.id).toBe("string");
    // 副作用已交给 waitUntil（本次请求不等它）
    expect(pending).toHaveLength(1);

    const getResponse = await func(
      makeRequest({ event: "COMMENT_GET", url: "/post/1" }, { cf: { country: "CN" } }),
      env,
      executionCtx,
    );
    const got = (await bodyOf(getResponse)) as { data: Array<Record<string, unknown>> };
    expect(got.data).toHaveLength(1);
    const stored = got.data[0];
    expect(stored.comment).toContain("<p>你好</p>");
    // xss 白名单垫片生效：script 标签与事件属性被剥掉
    expect(String(stored.comment)).not.toContain("<script");
    expect(String(stored.comment)).not.toContain("onerror");
    // IP 取自 CF-Connecting-IP；属地来自 request.cf（按评论的 ip 回查命中）
    expect(lookupRegion("1.2.3.4")).toBe("CN|0|广东省|深圳市|");
    // DTO 层的属地文案会剥掉「省/市」后缀（common 的 getIpRegion 语义）
    expect(stored.ipRegion).toBe("广东");

    await Promise.all(pending);
  });

  it("属地只在「同一 IP」命中：他人评论的属地不会串味", async () => {
    const binding = await bootstrap({ SHOW_REGION: "true" });
    const func = createCloudflareFunc();
    const env: CloudflareEnvLike = { DB: binding };
    // 甲（不同 IP）先留下一条评论，且落库时带上了自己的属地
    const db = new D1Database(binding);
    await db.addComment({
      _id: "other",
      nick: "甲",
      ip: "9.9.9.9",
      ipRegion: "US|0|California|Seattle|",
      url: "/post/2",
      comment: "hi",
      created: 1,
      updated: 1,
    });
    // 乙从另一个 IP 访问，request.cf 只描述乙
    const response = await func(
      makeRequest(
        { event: "COMMENT_GET", url: "/post/2" },
        { cf: { country: "JP", region: "Tokyo", city: "Tokyo" }, ip: "8.8.8.8" },
      ),
      env,
    );
    const body = (await bodyOf(response)) as { data: Array<Record<string, unknown>> };
    // 甲的属地来自库里（读库回填），不会错认成乙的
    expect(body.data[0].ipRegion).toBe("California");
    expect(lookupRegion("8.8.8.8")).toBe("JP|0|Tokyo|Tokyo|");
  });

  it("COUNTER_GET / GET_COMMENTS_COUNT / GET_RECENT_COMMENTS 走真 SQL", async () => {
    const binding = await bootstrap();
    const func = createCloudflareFunc();
    const env: CloudflareEnvLike = { DB: binding };
    await func(
      makeRequest({ event: "COMMENT_SUBMIT", url: "/post/3", ua: "UA", comment: "第一条" }),
      env,
    );
    await func(
      makeRequest({ event: "COMMENT_SUBMIT", url: "/post/4", ua: "UA", comment: "第二条" }),
      env,
    );

    const counter = await bodyOf(
      await func(makeRequest({ event: "COUNTER_GET", url: "/post/3", title: "页面" }), env),
    );
    // 首次访问：返回的是「自增前」的读取结果（1.x counterGet 语义）
    expect(counter.time).toBe(0);
    const counterAgain = await bodyOf(
      await func(makeRequest({ event: "COUNTER_GET", url: "/post/3" }), env),
    );
    expect(counterAgain.time).toBe(1);
    expect((await func(makeRequest({ event: "COUNTER_GET", url: "/post/4" }), env)).status).toBe(200);

    const counts = (await bodyOf(
      await func(makeRequest({ event: "GET_COMMENTS_COUNT", urls: ["/post/3", "/post/4", "/none"] }), env),
    )) as { data: Array<{ url: string; count: number }> };
    expect(counts.data).toEqual([
      { url: "/post/3", count: 1 },
      { url: "/post/4", count: 1 },
      { url: "/none", count: 0 },
    ]);

    const recent = (await bodyOf(
      await func(makeRequest({ event: "GET_RECENT_COMMENTS", pageSize: 10 }), env),
    )) as { data: Array<{ comment: string; commentText: string }> };
    expect(recent.data).toHaveLength(2);
    // html-to-text 动态加载（外置依赖）可用
    expect(recent.data[0].commentText).toContain("第");
  });

  it("CONFIG / PASSWORD_STATUS：未配置时的 1.x 语义", async () => {
    const binding = await bootstrap();
    const func = createCloudflareFunc();
    const env: CloudflareEnvLike = { DB: binding };
    const status = await bodyOf(
      await func(makeRequest({ event: "GET_PASSWORD_STATUS", version: "1.0.0" }), env),
    );
    expect(typeof status.code).toBe("number");
    const config = await bodyOf(await func(makeRequest({ event: "GET_CONFIG", version: "1.0.0" }), env));
    expect(config.code).toBe(0);
    expect(config).toHaveProperty("config");
  });

  it("损坏的请求体：不当成异常，按无参数处理", async () => {
    const binding = await bootstrap();
    const func = createCloudflareFunc();
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" },
      body: "{not json",
    });
    const response = await func(request, { DB: binding });
    expect(response.status).toBe(200);
    const body = await bodyOf(response);
    // 无 event：返回「云函数运行正常」形态（code 非 0）
    expect(body.code).not.toBe(0);
  });
});

describe("能力声明", () => {
  it("Cloudflare 行的能力形态（受限邮件 / 无 jsdom / 无 akismet 与 TMS）", () => {
    expect(cloudflareCapabilities.mail).toBe("restricted");
    expect(cloudflareCapabilities.domPurify).toBe(false);
    expect(cloudflareCapabilities.ip2region).toBe(true);
    expect(cloudflareCapabilities.akismet).toBe(false);
    expect(cloudflareCapabilities.tencentTms).toBe(false);
    expect(cloudflareCapabilities.imageUpload).toBe(true);
    expect(cloudflareCapabilities.qqAvatar).toBe(true);
    expect(cloudflareCapabilities.ai).toBe(false);
  });

  it("覆写「名副其实」：无能力门时可用的库都真的被注入（否则环节会静默失效）", async () => {
    const { installCloudflareLibs } = await import("../src/main");
    const { getDomPurify, getFormData, getIpToRegion, getNodemailer } = await import(
      "@twikoojs/common"
    );
    installCloudflareLibs();
    const domPurify = await getDomPurify(cloudflareCapabilities);
    expect(domPurify.sanitize("<script>x</script><p>ok</p>")).not.toContain("<script");
    expect(typeof (await getNodemailer(cloudflareCapabilities)).createTransport).toBe("function");
    expect(
      new (await getFormData(cloudflareCapabilities))() instanceof FormData,
    ).toBe(true);
    const searcher = (await getIpToRegion(cloudflareCapabilities)).create();
    expect(typeof searcher.binarySearchSync).toBe("function");
  });

  it("未注入覆写时，声明为 false 的能力被能力门拦下（对照：说明覆写不可缺）", async () => {
    const { getDomPurify, getNodemailer } = await import("@twikoojs/common");
    await expect(getDomPurify(cloudflareCapabilities)).rejects.toThrow("未声明 domPurify 能力");
    // mail 声明为 "restricted"，能力门只认 `=== true`，同样被拦下
    await expect(getNodemailer(cloudflareCapabilities)).rejects.toThrow("未声明 mail 能力");
  });

  it("D1 实例按绑定缓存（同一 isolate 不重复构造）", async () => {
    const { getD1Database } = await import("../src/main");
    const binding = createSqliteD1();
    expect(getD1Database({ DB: binding })).toBe(getD1Database({ DB: binding }));
  });
});

describe("依赖纪律", () => {
  it("Worker 产物不含只属于 Node 的重依赖（各自由能力门或覆写替代）", async () => {
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies: Record<string, string> };
    const names = Object.keys(pkg.dependencies);
    for (const forbidden of [
      "jsdom",
      "dompurify",
      "nodemailer",
      "mongodb",
      "tencentcloud-sdk-nodejs-tms",
      "akismet-api",
      "form-data",
      "@imaegoo/node-ip2region",
      "@xsai/generate-text",
    ]) {
      expect(names).not.toContain(forbidden);
    }
    // 无能力门（人人必备）的重依赖必须在（否则对应事件会报 LibLoadError）
    for (const required of ["xml2js", "html-to-text", "pushoo", "bowser", "marked"]) {
      expect(names).toContain(required);
    }
  });
});

/**
 * twikoo-netlify 适配器测试。
 *
 * 注入内存 Database 跑契约核心事件；验证 Netlify v1 返回体形态（body 字符串、
 * 204 无体）、x-nf-client-connection-ip IP 语义（IP 头可定位）、
 * dependencies 无 twikoo-vercel。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNetlifyFunc, handler, toTkRequest } from "../src/main";
import type { NetlifyEventLike } from "../src/main";
import type { Database } from "@twikoojs/common";
import { createMemoryAdapters } from "../../server-common/test/utils/memory-adapters";

/** 内存 Database 注入的处理器 */
function makeFunc(): (
  event: NetlifyEventLike,
) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const adapters = createMemoryAdapters();
  // common 源码态类型 → 产物类型视图收窄（范式）
  const db = adapters.database as unknown as Database;
  return createNetlifyFunc({ database: db });
}

/** 构造 Netlify 事件 */
function makeEvent(overrides: Partial<NetlifyEventLike> = {}): NetlifyEventLike {
  return {
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
    rawUrl: "https://x.test/.netlify/functions/twikoo",
    ...overrides,
  };
}

describe("twikoo-netlify 薄适配器", () => {
  it("happy：GET_FUNC_VERSION → 200 + body 字符串 + JSON 可解析", async () => {
    const fn = makeFunc();
    const result = await fn(makeEvent());
    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    const parsed = JSON.parse(result.body) as { code: number; version: string };
    expect(parsed.code).toBe(0);
    expect(typeof parsed.version).toBe("string");
  });

  it("happy：IP 语义——x-nf-client-connection-ip 优先（1.x TWIKOO_IP_HEADERS 对齐）", async () => {
    const req = toTkRequest(
      makeEvent({
        headers: { "x-nf-client-connection-ip": "5.6.7.8", "x-forwarded-for": "9.9.9.9" },
      }),
    );
    expect(req.ip).toBe("5.6.7.8");
    // 回退链：无专属头 → x-real-ip → x-forwarded-for 首跳
    const fallback = toTkRequest(makeEvent({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } }));
    expect(fallback.ip).toBe("1.1.1.1");
  });

  it("happy：OPTIONS 204 → 空体且保留 CORS 响应头", async () => {
    const fn = makeFunc();
    const result = await fn(
      makeEvent({ httpMethod: "OPTIONS", body: null, headers: { origin: "https://a.com" } }),
    );
    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("https://a.com");
    expect(result.headers["Access-Control-Allow-Methods"]).toBe("POST");
    expect(result.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("IP 头缺失 → ip 为空串（可定位：IP 用例红即头部映射错误）", () => {
    const req = toTkRequest(makeEvent({ headers: {} }));
    expect(req.ip).toBe("");
    // 错误头名（如误设 x-nf-ip）不会被采集—— 「误设 IP 头可定位」语义
    const wrong = toTkRequest(makeEvent({ headers: { "x-nf-ip": "7.7.7.7" } }));
    expect(wrong.ip).toBe("");
  });

  it("数据库连不上不外抛：200 + code 1000（1.x 语义）", async () => {
    const failingDb = {
      /**
       *
       */
      init: async () => {
        throw new Error("mongodb connect failed");
      },
    } as unknown as Database;
    const result = await createNetlifyFunc({ database: failingDb })(makeEvent());
    expect(result.statusCode).toBe(200);
    const parsed = JSON.parse(result.body) as { code: number; message: string };
    expect(parsed.code).toBe(1000);
    expect(parsed.message).toBe("mongodb connect failed");
  });

  it("适配器兜底：pipeline 之外的异常不抛给平台", async () => {
    const badEvent = {
      httpMethod: "POST",
      /**
       *
       */
      get headers(): Record<string, string> {
        throw new Error("boom before pipeline");
      },
      body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
    } as NetlifyEventLike;
    const result = await createNetlifyFunc({ database: {} as Database })(badEvent);
    expect(result.statusCode).toBe(200);
    const parsed = JSON.parse(result.body) as { code: number; message: string };
    expect(parsed.code).toBe(1000);
    expect(parsed.message).toBe("boom before pipeline");
  });

  it("dependencies 无 twikoo-vercel；handler 为 v1 具名导出", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["twikoo-vercel"]).toBeUndefined();
    expect(pkg.dependencies["@twikoojs/common"]).toBe("workspace:*");
    expect(typeof handler).toBe("function");
  });
});

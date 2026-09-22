/**
 * twikoo-deta 适配器测试。
 *
 * 响应侧重点验收：状态码与响应头**透传**（OPTIONS 预检的 204 + CORS 头、
 * 限流的 429），对齐 #1174 的同类回归（AWS Lambda 丢预检 CORS 头）。
 */
import { describe, expect, it } from "vitest";
import { createDetaHandler, extractIp, fromTkResponse, toTkRequest } from "../src/main";
import type { Database, TkResponse } from "@twikoojs/common";
import { createMemoryAdapters } from "../../server-common/test/utils/memory-adapters";

/** 响应对象最小结构面（与 src 的 MinimalRes 一致） */
type TestRes = {
  writeHead(code: number, headers: Record<string, string>): unknown;
  end(body?: string): unknown;
};

/**
 * 记录型响应替身：捕获 writeHead 的状态码/响应头与 end 的响应体。
 * @returns 响应替身与记录对象
 */
function makeRes(): {
  res: TestRes;
  out: { status: number; headers: Record<string, string>; body?: string; ended: boolean };
} {
  const out: { status: number; headers: Record<string, string>; body?: string; ended: boolean } = {
    status: 0,
    headers: {},
    body: undefined,
    ended: false,
  };
  const res: TestRes = {
    /**
     * 记录状态码与响应头。
     * @param code 状态码
     * @param headers 响应头
     * @returns 响应对象自身
     */
    writeHead: (code: number, headers: Record<string, string>) => {
      out.status = code;
      out.headers = headers ?? {};
      return res;
    },
    /**
     * 记录响应体。
     * @param body 响应体
     * @returns 响应对象自身
     */
    end: (body?: string) => {
      out.body = body;
      out.ended = true;
      return res;
    },
  };
  return { res, out };
}

/** 内存 Database 注入的处理器 */
function makeFunc() {
  const adapters = createMemoryAdapters();
  const db = adapters.database as unknown as Database;
  return createDetaHandler({ database: db });
}

describe("twikoo-deta 薄适配器", () => {
  it("happy：GET_FUNC_VERSION → 200 业务 JSON", async () => {
    const handler = makeFunc();
    const { res, out } = makeRes();
    await handler({ method: "POST", headers: {}, body: { event: "GET_FUNC_VERSION" } }, res);
    expect(out.status).toBe(200);
    expect(out.headers["Content-Type"]).toBe("application/json");
    expect((JSON.parse(out.body ?? "{}") as { code: number }).code).toBe(0);
  });

  it("IP 提取：cf-connecting-ip 优先（Cloudflare CDN 形态）", () => {
    expect(extractIp({ "cf-connecting-ip": "6.6.6.6" })).toBe("6.6.6.6");
    expect(extractIp({})).toBe("");
    const req = toTkRequest({
      method: "POST",
      headers: { "cf-connecting-ip": "6.6.6.6" },
      body: { event: "GET_FUNC_VERSION" },
    });
    expect(req.ip).toBe("6.6.6.6");
  });

  it("OPTIONS 预检：204 + CORS 头 + 无响应体（#1174 同类回归）", async () => {
    const handler = makeFunc();
    const { res, out } = makeRes();
    await handler(
      {
        method: "OPTIONS",
        headers: { origin: "http://localhost:9820", "access-control-request-method": "POST" },
        body: {},
      },
      res,
    );
    expect(out.status).toBe(204);
    // 改前写死 200 并丢弃 tkRes.headers，下面这几个头会全部消失 → 浏览器预检失败
    expect(out.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:9820");
    expect(out.headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(out.headers["Access-Control-Max-Age"]).toBe("600");
    // 204 不带响应体
    expect(out.body).toBeUndefined();
  });
});

describe("twikoo-deta 响应透传（fromTkResponse）", () => {
  it("204：无体，且不额外补 Content-Type", () => {
    const { res, out } = makeRes();
    const tkRes: TkResponse = {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: {},
    };
    fromTkResponse(res, tkRes);
    expect(out.status).toBe(204);
    expect(out.headers).toEqual({ "Access-Control-Allow-Origin": "*" });
    expect(out.body).toBeUndefined();
  });

  it("429：状态码透传（2.0 的限流改进依赖它映射「请求过于频繁」）", () => {
    const { res, out } = makeRes();
    const tkRes: TkResponse = {
      status: 429,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: { code: 1000, message: "请求过于频繁" },
    };
    fromTkResponse(res, tkRes);
    expect(out.status).toBe(429);
    expect(out.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(out.headers["Content-Type"]).toBe("application/json");
    expect(out.body).toContain("请求过于频繁");
  });
});

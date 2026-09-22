/**
 * @twikoojs/aws-lambda 适配器测试。
 *
 * 注入内存 Database（Mongo 语义）跑契约核心事件；验证 v1/v2 双 payload、
 * base64 body、sourceIp 提取。
 */
import { describe, expect, it } from "vitest";
import { createLambdaFunc, toTkRequest } from "../src/main";
import type { ApiGatewayEventLike } from "../src/main";
import type { Database } from "@twikoojs/common";
import { createMemoryAdapters } from "../../server-common/test/utils/memory-adapters";

/** 内存 Database 注入的处理器 */
function makeFunc(): (
  event: ApiGatewayEventLike,
) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const adapters = createMemoryAdapters();
  const db = adapters.database as unknown as Database;
  return createLambdaFunc({ database: db });
}

/** v2 HTTP API 事件 */
function makeEventV2(overrides: Partial<ApiGatewayEventLike> = {}): ApiGatewayEventLike {
  return {
    requestContext: { http: { method: "POST", sourceIp: "4.5.6.7" } },
    headers: {},
    body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
    isBase64Encoded: false,
    ...overrides,
  };
}

describe("@twikoojs/aws-lambda 薄适配器", () => {
  it("happy：v2 payload → GET_FUNC_VERSION code 0 + body 字符串", async () => {
    const result = await makeFunc()(makeEventV2());
    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    const parsed = JSON.parse(result.body) as { code: number };
    expect(parsed.code).toBe(0);
  });

  it("happy：v1 payload（顶层 httpMethod + identity.sourceIp）", async () => {
    const result = await makeFunc()({
      httpMethod: "POST",
      requestContext: { identity: { sourceIp: "7.8.9.0" } },
      headers: {},
      body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
    });
    expect(result.statusCode).toBe(200);
  });

  it("204 预检：保留管线产出的 CORS 头（#1174 回归）", async () => {
    const result = await makeFunc()({
      requestContext: { http: { method: "OPTIONS", sourceIp: "4.5.6.7" } },
      headers: { origin: "https://example.com" },
      body: "",
      isBase64Encoded: false,
    });
    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
    expect(result.headers["Access-Control-Allow-Methods"]).toBe("POST");
  });

  it("base64 body 解码", async () => {
    const b64 = Buffer.from(JSON.stringify({ event: "GET_FUNC_VERSION" })).toString("base64");
    const result = await makeFunc()(makeEventV2({ body: b64, isBase64Encoded: true }));
    expect(result.statusCode).toBe(200);
  });

  it("sourceIp 提取：v2 http.sourceIp 优先、v1 identity.sourceIp 次之", () => {
    expect(toTkRequest(makeEventV2()).ip).toBe("4.5.6.7");
    expect(
      toTkRequest({
        requestContext: { identity: { sourceIp: "8.8.8.8" } },
        headers: {},
        body: "{}",
      }).ip,
    ).toBe("8.8.8.8");
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
    const result = await createLambdaFunc({ database: failingDb })(makeEventV2());
    expect(result.statusCode).toBe(200);
    const parsed = JSON.parse(result.body) as { code: number; message: string };
    expect(parsed.code).toBe(1000);
    expect(parsed.message).toBe("mongodb connect failed");
  });

  it("适配器兜底：pipeline 之外的异常不抛给平台", async () => {
    const badEvent = {
      /**
       *
       */
      get headers(): Record<string, string> {
        throw new Error("boom before pipeline");
      },
      body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
    } as ApiGatewayEventLike;
    const result = await createLambdaFunc({ database: {} as Database })(badEvent);
    expect(result.statusCode).toBe(200);
    const parsed = JSON.parse(result.body) as { code: number; message: string };
    expect(parsed.code).toBe(1000);
    expect(parsed.message).toBe("boom before pipeline");
  });
});

/**
 * twikoo-aws-lambda 适配器测试（T24）。
 *
 * 注入内存 Database（Mongo 语义）跑契约核心事件；验证 v1/v2 双 payload、
 * base64 body、sourceIp 提取、行数门禁。
 */
import { readFileSync } from "node:fs";
import { countSourceLines } from "../../../test/utils/line-count";
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

describe("twikoo-aws-lambda 薄适配器（T24）", () => {
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

  it("源码行数门禁：main.ts + index.ts < 150 行", () => {
    /**
     *
     */
    const lines = (path: string): number =>
      countSourceLines(readFileSync(new URL(path, import.meta.url), "utf8"));
    expect(lines("../src/main.ts") + lines("../src/index.ts")).toBeLessThan(150);
  });
});

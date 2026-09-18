/**
 * twikoo-vercel 适配器测试（T21）。
 *
 * 注入内存 Database 跑契约核心事件；验证 (req,res) 映射（CORS 头写入、
 * 429 状态码透传、OPTIONS 204）、BC-13 依赖指向（@twikoojs/common）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createVercelFunc, toTkRequest, default as vercelHandler } from "../src/main";
import type { VercelRequestLike, VercelResponseLike } from "../src/main";
import { resetRequestTimes } from "@twikoojs/common";
import { vi } from "vitest";
import type { Database } from "@twikoojs/common";
import { createMemoryAdapters } from "../../server-common/test/utils/memory-adapters";

/** 记录型 Vercel 响应替身 */
function makeRes(): {
  res: VercelResponseLike;
  calls: { status?: number; headers: Record<string, string>; body?: unknown };
} {
  const calls: { status?: number; headers: Record<string, string>; body?: unknown } = {
    headers: {},
  };
  const res: VercelResponseLike = {
    /**
     *
     */
    status: (code) => {
      calls.status = code;
      return res;
    },
    /**
     *
     */
    setHeader: (name, value) => {
      calls.headers[name] = value;
      return res;
    },
    /**
     *
     */
    json: (body) => {
      calls.body = body;
      return res;
    },
    /**
     *
     */
    end: () => {
      calls.body = undefined;
      return res;
    },
  };
  return { res, calls };
}

/** 内存 Database 注入的处理器 */
function makeFunc(): {
  fn: (req: VercelRequestLike, res: VercelResponseLike) => Promise<void>;
  db: Database;
} {
  const adapters = createMemoryAdapters();
  // common 源码态类型 → 产物类型视图收窄（T20 范式）
  const db = adapters.database as unknown as Database;
  const fn = createVercelFunc({ database: db });
  return { fn, db };
}

describe("twikoo-vercel 薄适配器（T21）", () => {
  it("happy：GET_FUNC_VERSION → 200 JSON + accessToken 回填", async () => {
    const { fn, db } = makeFunc();
    await db.saveConfig({ ADMIN_PASS: "x" });
    const { res, calls } = makeRes();
    await fn(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: { event: "GET_FUNC_VERSION" },
      },
      res,
    );
    expect(calls.status).toBe(200);
    expect((calls.body as { code: number }).code).toBe(0);
    expect(typeof (calls.body as { version: string }).version).toBe("string");
  });

  it("happy：业务响应写入 CORS 头（1.x 头集）", async () => {
    const { fn } = makeFunc();
    const { res, calls } = makeRes();
    await fn(
      {
        method: "POST",
        headers: { origin: "https://example.com" },
        body: { event: "GET_FUNC_VERSION" },
      },
      res,
    );
    expect(calls.headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
    expect(calls.headers["Access-Control-Allow-Methods"]).toBe("POST");
  });

  it("OPTIONS 预检 → 204 无体", async () => {
    const { fn } = makeFunc();
    const { res, calls } = makeRes();
    await fn(
      { method: "OPTIONS", headers: { origin: "https://example.com" }, body: undefined },
      res,
    );
    expect(calls.status).toBe(204);
    expect(calls.body).toBeUndefined();
  });

  it("限流透传：TWIKOO_THROTTLE=1 → 第 2 请求 429", async () => {
    vi.stubEnv("TWIKOO_THROTTLE", "1");
    resetRequestTimes();
    const adapters = createMemoryAdapters();
    const db = adapters.database as unknown as Database;
    const fn = createVercelFunc({ database: db });
    const req: VercelRequestLike = {
      method: "POST",
      headers: {},
      body: { event: "GET_FUNC_VERSION" },
    };
    await fn(req, makeRes().res);
    const { res, calls } = makeRes();
    await fn(req, res);
    vi.unstubAllEnvs();
    expect(calls.status).toBe(429);
    expect((calls.body as { code: number }).code).toBe(1000);
  });

  it("toTkRequest：x-forwarded-for 首跳取 IP", () => {
    const req = toTkRequest({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } });
    expect(req.ip).toBe("1.1.1.1");
  });

  it("BC-13：依赖指向 @twikoojs/common（不再内含业务逻辑）", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["@twikoojs/common"]).toBe("workspace:*");
    expect(typeof vercelHandler).toBe("function");
  });
});

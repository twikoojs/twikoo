/**
 * twikoo-vercel 适配器测试。
 *
 * 注入内存 Database 跑契约核心事件；验证 (req,res) 映射（CORS 头写入、
 * 429 状态码透传、OPTIONS 204）、依赖指向（@twikoojs/common）。
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
  // common 源码态类型 → 产物类型视图收窄（范式）
  const db = adapters.database as unknown as Database;
  const fn = createVercelFunc({ database: db });
  return { fn, db };
}

describe("twikoo-vercel 薄适配器", () => {
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

  it("数据库连不上不外抛：200 + code 1000（1.x 语义）", async () => {
    // 连接失败由 pipeline 内的 database.init() 抛出，pipeline 统一兜成 200 + code 1000
    const failingDb = {
      /**
       *
       */
      init: async () => {
        throw new Error("mongodb connect failed");
      },
    } as unknown as Database;
    const fn = createVercelFunc({ database: failingDb });
    const { res, calls } = makeRes();
    await fn(
      {
        method: "POST",
        headers: { origin: "https://example.com" },
        body: { event: "GET_FUNC_VERSION" },
      },
      res,
    );
    expect(calls.status).toBe(200);
    expect((calls.body as { code: number }).code).toBe(1000);
    expect((calls.body as { message: string }).message).toBe("mongodb connect failed");
    // 1.x 的 allowCors 同样排在 readConfig 之后，异常响应也就没有 CORS 头
    expect(calls.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("适配器兜底：pipeline 之外的异常不抛给平台", async () => {
    const fn = createVercelFunc({ database: {} as Database });
    const { res, calls } = makeRes();
    const badReq: VercelRequestLike = {
      method: "POST",
      /** 取 headers 即抛错：模拟发生在 pipeline 之前的异常 */
      get headers(): Record<string, string> {
        throw new Error("boom before pipeline");
      },
      body: { event: "GET_FUNC_VERSION" },
    };
    await fn(badReq, res);
    expect(calls.status).toBe(200);
    expect((calls.body as { code: number }).code).toBe(1000);
    expect((calls.body as { message: string }).message).toBe("boom before pipeline");
  });

  it("异常兜底：响应已发出时不再二次写入", async () => {
    const fn = createVercelFunc({ database: {} as Database });
    const { res, calls } = makeRes();
    res.headersSent = true;
    const badReq: VercelRequestLike = {
      method: "POST",
      /**
       *
       */
      get headers(): Record<string, string> {
        throw new Error("boom before pipeline");
      },
      body: { event: "GET_FUNC_VERSION" },
    };
    await fn(badReq, res);
    expect(calls.status).toBeUndefined();
    expect(calls.body).toBeUndefined();
  });

  it("依赖指向 @twikoojs/common（不再内含业务逻辑）", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["@twikoojs/common"]).toBe("workspace:*");
    expect(typeof vercelHandler).toBe("function");
  });

  it("CJS 产物 require 后直接是 handler（1.7.x 部署壳兼容）", () => {
    const distPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
    expect(existsSync(distPath), "缺少 dist/index.js —— 请先运行 pnpm build").toBe(true);
    // 存量 Vercel 部署壳写的是 `module.exports = require("twikoo-vercel")` 后直接调用，
    // 拿到的必须是函数（不是 exports 对象）
    const mod = createRequire(import.meta.url)("../dist/index.js") as { default?: unknown };
    expect(typeof mod).toBe("function");
    expect(mod.default).toBe(mod);
  });
});

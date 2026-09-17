/**
 * twikoo-func 适配器测试（T20）。
 *
 * 注入 CloudBase 数据库句柄替身（以工作区内存 Database 为载体）跑契约核心事件；
 * 验证 main 入口形态 / BC-12 转发导出 / <150 行源码门禁。
 */
import { readFileSync } from "node:fs";
import { countSourceLines } from "../../../test/utils/line-count";
import { describe, expect, it } from "vitest";
import { createTwikooFunc, toTkRequest } from "../src/main";
import type { CloudBaseDatabaseLike, Database } from "@twikoojs/common";
import { createMemoryAdapters } from "../../server-common/test/utils/memory-adapters";

/**
 * 构造 CloudBase 数据库句柄替身（database() 返回内存 Database）。
 * @returns 句柄与底层数据库
 */
function makeMockTcb(): { tcb: CloudBaseDatabaseLike; db: Database } {
  const adapters = createMemoryAdapters();
  // 替身 Database 来自 common 源码类型（测试工具），与 common 产物类型结构
  // 一致但声明身份不同——此处统一按产物类型视图收窄
  const db = adapters.database as unknown as Database;
  const tcb = {
    /** database() 返回内存库 */
    database: () => db as never,
    command: {},
  } as unknown as CloudBaseDatabaseLike;
  return { tcb, db };
}

describe("twikoo-func 薄适配器（T20）", () => {
  it("main 入口形态：事件即请求体 → GET_FUNC_VERSION 返回 code 0 + version", async () => {
    const { tcb, db } = makeMockTcb();
    await db.saveConfig({ ADMIN_PASS: "x" });
    const fn = createTwikooFunc({ database: tcb });
    const res = await fn({ event: "GET_FUNC_VERSION" });
    expect(res.code).toBe(0);
    expect(typeof res.version).toBe("string");
  });

  it("toTkRequest：headers 小写化 + x-real-ip 取 IP + 非对象事件兜底", () => {
    const req = toTkRequest({
      headers: { "X-Real-IP": "9.8.7.6", "X-Custom": "v" },
      body: { event: "GET_FUNC_VERSION" },
    });
    expect(req.headers["x-custom"]).toBe("v");
    expect(req.ip).toBe("9.8.7.6");
    const fallback = toTkRequest(null);
    expect(fallback.body).toEqual({});
  });

  it("BC-12：转发导出存在（common 公共导出经 twikoo-func 可取）", async () => {
    const mod = await import("../src/index");
    expect(typeof mod.main).toBe("function");
    expect(typeof mod.createTwikooFunc).toBe("function");
    expect(typeof mod.getPostSubmitService).toBe("function");
    expect(typeof mod.RES_CODE).toBe("object");
  });

  it("源码行数门禁：main.ts + index.ts < 150 行", () => {
    /**
     *
     */
    const lines = (path: string): number =>
      countSourceLines(readFileSync(new URL(path, import.meta.url), "utf8"));
    const total = lines("../src/main.ts") + lines("../src/index.ts");
    expect(total).toBeLessThan(150);
  });
});

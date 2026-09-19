/**
 * twikoo-func 适配器测试。
 *
 * 注入 CloudBase 数据库句柄替身（以工作区内存 Database 为载体）跑契约核心事件；
 * 验证 main 入口形态 / <150 行源码门禁。
 */
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

describe("twikoo-func 薄适配器", () => {
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

  it("toTkRequest：IP 回退链逐级可达（回归：曾因 ?? 短路使后两级成死代码）", () => {
    delete process.env.TCB_SOURCE_IP;
    // 1. 上下文 TCB_SOURCE_IP 优先（1.x auth.getClientIP() 即读此值）
    expect(toTkRequest({}, { environment: { TCB_SOURCE_IP: "1.1.1.1" } }).ip).toBe("1.1.1.1");
    // 2. 无 TCB_SOURCE_IP → x-real-ip
    expect(toTkRequest({ headers: { "x-real-ip": "2.2.2.2" } }).ip).toBe("2.2.2.2");
    // 3. 无 x-real-ip → x-forwarded-for 首跳
    expect(toTkRequest({ headers: { "x-forwarded-for": "3.3.3.3, 4.4.4.4" } }).ip).toBe("3.3.3.3");
    // 4. 仅剩 requestContext.http.sourceIp（此前永远取不到）
    expect(toTkRequest({ requestContext: { http: { sourceIp: "5.5.5.5" } } }).ip).toBe("5.5.5.5");
    // 5. 全缺失 → 空串
    expect(toTkRequest({}).ip).toBe("");
  });
});

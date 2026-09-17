/**
 * twikoo-deta 适配器测试（T24）。
 */
import { readFileSync } from "node:fs";
import { countSourceLines } from "../../../test/utils/line-count";
import { describe, expect, it } from "vitest";
import { createDetaHandler, extractIp, toTkRequest } from "../src/main";
import type { Database } from "@twikoojs/common";
import { createMemoryAdapters } from "../../server-common/test/utils/memory-adapters";

/** 内存 Database 注入的处理器 */
function makeFunc() {
  const adapters = createMemoryAdapters();
  const db = adapters.database as unknown as Database;
  return createDetaHandler({ database: db });
}

describe("twikoo-deta 薄适配器（T24）", () => {
  it("happy：GET_FUNC_VERSION → 200 业务 JSON", async () => {
    const handler = makeFunc();
    const chunks: string[] = [];
    const res = {
      /** writeHead 替身 */
      writeHead: () => {},
      /**
       *
       */
      end: (body?: string) => {
        if (body) chunks.push(body);
      },
    };
    await handler({ method: "POST", headers: {}, body: { event: "GET_FUNC_VERSION" } }, res);
    const parsed = JSON.parse(chunks.join("")) as { code: number };
    expect(parsed.code).toBe(0);
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

  it("源码行数门禁：main.ts + index.ts < 150 行", () => {
    /** 读取相对路径源文件并统计行数（统一口径，见 countSourceLines） */
    const lines = (path: string): number =>
      countSourceLines(readFileSync(new URL(path, import.meta.url), "utf8"));
    expect(lines("../src/main.ts") + lines("../src/index.ts")).toBeLessThanOrEqual(150);
  });
});

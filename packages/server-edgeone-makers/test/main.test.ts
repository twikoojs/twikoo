/**
 * twikoo-edgeone-makers 适配器测试（T24）。
 *
 * 注入内存 BlobKV store 跑契约核心事件；验证受限能力形态（DOMPurify 直通、
 * 内嵌 Cap 未启用语义）、EO 体积门禁脚本、行数门禁。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEoMakersFunc, eoCapabilities } from "../src/main";
import type { EoEventLike } from "../src/main";

/** 内存 Blob KV store（JSON 往返模拟持久化） */
function makeStore(): {
  store: Parameters<typeof createEoMakersFunc>[0] extends { store?: infer S } ? S : never;
} {
  const map = new Map<string, string>();
  return {
    store: {
      /**
       *
       */
      async get(key: string): Promise<unknown> {
        return map.has(key) ? JSON.parse(map.get(key) as string) : null;
      },
      /**
       *
       */
      async setJSON(key: string, value: unknown): Promise<void> {
        map.set(key, JSON.stringify(value));
      },
      /**
       *
       */
      async delete(key: string): Promise<void> {
        map.delete(key);
      },
    } as never,
  };
}

/** EO 事件构造 */
function makeEvent(overrides: Partial<EoEventLike> = {}): EoEventLike {
  return {
    method: "POST",
    headers: {},
    body: { event: "GET_FUNC_VERSION" },
    ...overrides,
  };
}

describe("twikoo-edgeone-makers 薄适配器（T24）", () => {
  it("happy：内存 BlobKV → GET_FUNC_VERSION code 0", async () => {
    const { store } = makeStore();
    const fn = createEoMakersFunc({ store });
    const result = await fn(makeEvent());
    expect(result.status).toBe(200);
    const parsed = JSON.parse(result.body) as { code: number };
    expect(parsed.code).toBe(0);
  });

  it("受限能力：mail restricted / domPurify false / akismet false / tencentTms false", () => {
    expect(eoCapabilities.mail).toBe("restricted");
    expect(eoCapabilities.domPurify).toBe(false);
    expect(eoCapabilities.akismet).toBe(false);
    expect(eoCapabilities.tencentTms).toBe(false);
    expect(eoCapabilities.ip2region).toBe(true);
  });

  it("happy：直通 DOMPurify 下 COMMENT_SUBMIT 原样入库（BlobKV 持久化语义）", async () => {
    const { store } = makeStore();
    const fn = createEoMakersFunc({ store });
    const result = await fn(
      makeEvent({
        body: {
          event: "COMMENT_SUBMIT",
          nick: "eo用户",
          url: "/eo/1",
          ua: "UA",
          comment: "<p>评论<b>加粗</b></p>",
        },
      }),
    );
    expect(result.status).toBe(200);
    // 再次读取（store 持久化语义）：评论可见
    const get = await fn(makeEvent({ body: { event: "COMMENT_GET", url: "/eo/1" } }));
    const data = JSON.parse(get.body) as { data: Array<{ nick: string; comment: string }> };
    expect(data.data[0].nick).toBe("eo用户");
    expect(data.data[0].comment).toContain("加粗");
  });

  it("体积门禁脚本：依赖清单无 nodemailer/jsdom（QA− 语义）", async () => {
    const { execFileSync } = await import("node:child_process");
    // 正向：脚本对当前 package.json 绿
    execFileSync(process.execPath, ["scripts/check-eo-size.mjs"], {
      cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
    });
    // 反向：临时注入 nodemailer 依赖 → 红
    const { readFileSync: rf, writeFileSync: wf } = await import("node:fs");
    const pkgPath = new URL("../package.json", import.meta.url).pathname.replace(
      /^\/([A-Z]:)/,
      "$1",
    );
    const original = rf(pkgPath, "utf8");
    const pkg = JSON.parse(original);
    pkg.dependencies.nodemailer = "^9.0.0";
    wf(pkgPath, JSON.stringify(pkg, null, 2));
    let failed = false;
    try {
      execFileSync(process.execPath, ["scripts/check-eo-size.mjs"], {
        cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
      });
    } catch {
      failed = true;
    }
    wf(pkgPath, original);
    expect(failed).toBe(true);
  });

  it("源码行数门禁：main.ts + index.ts < 150 行", () => {
    /**
     *
     */
    const lines = (path: string): number =>
      readFileSync(new URL(path, import.meta.url), "utf8")
        .trimEnd()
        .split("\n").length;
    expect(lines("../src/main.ts") + lines("../src/index.ts")).toBeLessThanOrEqual(150);
  });
});

/**
 * 重依赖预热测试（`src/prewarm.ts`）。
 *
 * 断言的是「**预热真的生效**」，而不是「jsdom 能不能装」：
 * 把 lib-loader 的动态导入缝换成必然抛错的实现，再去调 `getDomPurify()` ——
 * 若仍能拿到可用的消毒器，说明走的是 `setCustomLibs` 注入的覆写，
 * 即 `loadLib` 根本没被调用（这正是把 3 秒开销移出调用路径的机制）。
 */
import { describe, expect, it } from "vitest";
import { getDomPurify, setLibImporter, type Capabilities } from "@twikoojs/common";
import "../src/prewarm";

/** 只声明 `domPurify` 能力的替身（`getDomPurify` 只读这一项） */
const domPurifyOnly = { domPurify: true } as unknown as Capabilities;

describe("CloudBase 重依赖预热", () => {
  it("预热后 getDomPurify 走覆写，不触发动态加载", async () => {
    setLibImporter(() => {
      throw new Error("预热失效：不该触发动态加载");
    });
    const DOMPurify = await getDomPurify(domPurifyOnly);
    expect(typeof DOMPurify.sanitize).toBe("function");
  });

  it("覆写实例真的能消毒（不是空壳）", async () => {
    const DOMPurify = await getDomPurify(domPurifyOnly);
    const sanitized = DOMPurify.sanitize('<p>ok</p><script>bad()</script>', {
      FORBID_TAGS: ["style"],
      FORBID_ATTR: ["style"],
    });
    expect(sanitized).toContain("ok");
    expect(sanitized).not.toContain("<script>");
  });
});

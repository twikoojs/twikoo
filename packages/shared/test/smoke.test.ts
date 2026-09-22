import { describe, expect, it } from "vitest";
import { ALL_EVENTS, PUSHOO_CHANNELS, VERSION } from "../src";

/**
 * @twikoojs/shared 真实行为冒烟用例。
 *
 * 断言的是包导出的真实不变量（渠道清单 / 事件清单 / 版本占位符），
 * 而非恒真占位——任一常量被误改时本用例必然失败。
 */
describe("@twikoojs/shared 导出冒烟", () => {
  it("PUSHOO_CHANNELS 恰为 21 个渠道，且不含 1.x 遗留别名 serverchain", () => {
    expect(PUSHOO_CHANNELS.length).toBe(21);
    expect(PUSHOO_CHANNELS).not.toContain("serverchain");
    // Push Plus Hxtrip 服务已停止，渠道随之移除
    expect(PUSHOO_CHANNELS).not.toContain("pushplushxtrip");
    // 渠道名不重复
    expect(new Set(PUSHOO_CHANNELS).size).toBe(PUSHOO_CHANNELS.length);
  });

  it("ALL_EVENTS 恰为 25 个事件标识符（24 客户端事件 + 服务端内部事件 POST_SUBMIT），且值唯一", () => {
    expect(ALL_EVENTS.length).toBe(25);
    expect(new Set(ALL_EVENTS).size).toBe(ALL_EVENTS.length);
  });

  it("不含臆造的事件名 HIDDEN / VISIBLE（二者只是 COMMENT_GET_FOR_ADMIN 的 type 取值）", () => {
    expect(ALL_EVENTS).not.toContain("HIDDEN");
    expect(ALL_EVENTS).not.toContain("VISIBLE");
  });

  it("VERSION 是非空字符串（构建期占位符机制）", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});

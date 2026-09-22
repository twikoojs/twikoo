/**
 * dispatcher 分发测试。
 *
 * 重点：switch 全量枚举（25 事件标识符清单）与注册表解析行为；以及
 * `COMMENT_GET_FOR_ADMIN` 的 `type` 筛选。
 *
 * ⚠️ `HIDDEN` / `VISIBLE` 是 `type` 的**参数取值，不是事件名**——1.x 从未把二者作为
 * 事件分发（见 1.x `getCommentSearchCondition` 的嵌套 switch 与客户端
 * TkAdminComment.vue 的筛选下拉）。重构期曾误加为兼容事件分支，已删除；本文件保留
 * 「当事件发送 → 事件不存在」的断言作为回归守卫。
 */
import { afterEach, describe, expect, it } from "vitest";
import { COMMENT_GET_FOR_ADMIN, type TwikooEvent } from "@twikoojs/shared";
import {
  createHandler,
  createRequestLogger,
  dispatch,
  registerHandler,
  resetHandlers,
  RES_CODE,
} from "../../src/index";
import type { PipelineContext, TkRequestBody } from "../../src/index";
import { registerDefaultHandlers } from "../../src/handlers";
import { createMemoryAdapters, makeRequest } from "../utils/memory-adapters";

afterEach(() => {
  resetHandlers();
  registerDefaultHandlers();
});

/** 构造最小分发上下文（dispatch 单测不经过 pipeline 八步；logger 用真实实现） */
function makeCtx(body: TkRequestBody): PipelineContext {
  return {
    request: makeRequest({ body }),
    requestId: "test-request-id",
    accessToken: "test-token",
    config: {},
    adapters: createMemoryAdapters(),
    logger: createRequestLogger("test-request-id"),
  };
}

describe("dispatcher 分发", () => {
  it("COMMENT_GET_FOR_ADMIN 按 type 参数筛选，且 HIDDEN / VISIBLE 不是事件名", async () => {
    const seen: Record<string, unknown>[] = [];
    registerHandler(COMMENT_GET_FOR_ADMIN, async (ctx) => {
      seen.push({ ...ctx.request.body });
      return { code: RES_CODE.SUCCESS, count: 0, data: [] };
    });
    const handler = createHandler(createMemoryAdapters());
    // 真实机制：type 参数（VISIBLE / HIDDEN / 空 = 全部）
    for (const type of ["HIDDEN", "VISIBLE", undefined]) {
      await handler(makeRequest({ body: { event: COMMENT_GET_FOR_ADMIN, type, per: 5, page: 1 } }));
    }
    expect(seen.map((body) => body.type)).toEqual(["HIDDEN", "VISIBLE", undefined]);

    // 回归守卫：把 HIDDEN / VISIBLE 当事件名发送 → 未注册，走 default（事件不存在）
    for (const legacy of ["HIDDEN", "VISIBLE"]) {
      const res = await handler(makeRequest({ body: { event: legacy as unknown as TwikooEvent } }));
      expect(res.body.code, `${legacy} 不应是事件名`).toBe(RES_CODE.EVENT_NOT_EXIST);
    }
  });

  it("已枚举但未注册的常规事件：dispatch 抛 HandlerNotRegisteredError（迁移守卫）", async () => {
    resetHandlers(); // 清空默认注册，模拟「实现尚未接入」的状态
    await expect(dispatch(makeCtx({ event: "COMMENT_GET" } as TkRequestBody))).rejects.toThrow(
      /事件 COMMENT_GET 的处理器尚未注册/,
    );
  });

  it("switch 全量枚举 25 个事件标识符（清单完整性）", async () => {
    // 从源码静态核对 switch 分支数（26 = 24 客户端事件 + 服务端内部事件 POST_SUBMIT + default 兜底）
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../src/core/dispatcher.ts", import.meta.url), "utf8");
    const caseCount = source.match(/case [A-Z_]+:/g)?.length ?? 0;
    expect(caseCount).toBe(25);
  });
});

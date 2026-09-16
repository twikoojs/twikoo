/**
 * dispatcher 分发测试（T13）。
 *
 * 重点：验收 5「HIDDEN 分支等价于 COMMENT_GET_FOR_ADMIN 的 type」——
 * 兼容分支派生的请求体与客户端显式携带 type 参数的请求体完全一致；
 * 以及 switch 全量枚举（26 事件清单）与注册表解析行为。
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

describe("dispatcher 分发（T13）", () => {
  it("验收 5：HIDDEN 分支等价于 COMMENT_GET_FOR_ADMIN 携带 type=HIDDEN", async () => {
    const seen: Record<string, unknown>[] = [];
    registerHandler(COMMENT_GET_FOR_ADMIN, async (ctx) => {
      seen.push({ ...ctx.request.body });
      return { code: RES_CODE.SUCCESS, count: 0, data: [] };
    });
    const handler = createHandler(createMemoryAdapters());
    // 兼容事件分支调用
    await handler(
      makeRequest({ body: { event: "HIDDEN" as unknown as TwikooEvent, per: 5, page: 1 } }),
    );
    // 客户端显式 type 参数调用
    await handler(
      makeRequest({
        body: { event: COMMENT_GET_FOR_ADMIN, type: "HIDDEN", per: 5, page: 1 },
      }),
    );
    // 两者到达 handler 的请求体完全一致（type 注入 + 其余字段透传）
    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0].type).toBe("HIDDEN");
  });

  it("VISIBLE 分支同理等价于 type=VISIBLE", async () => {
    const seen: Record<string, unknown>[] = [];
    registerHandler(COMMENT_GET_FOR_ADMIN, async (ctx) => {
      seen.push({ ...ctx.request.body });
      return { code: RES_CODE.SUCCESS, count: 0, data: [] };
    });
    const handler = createHandler(createMemoryAdapters());
    await handler(
      makeRequest({ body: { event: "VISIBLE" as unknown as TwikooEvent, per: 10, page: 2 } }),
    );
    expect(seen[0].type).toBe("VISIBLE");
    expect(seen[0].per).toBe(10);
    expect(seen[0].page).toBe(2);
  });

  it("已枚举但未注册的常规事件：dispatch 抛 HandlerNotRegisteredError（T18 迁移守卫）", async () => {
    resetHandlers(); // 清空默认注册，模拟 T18 前无实现状态
    await expect(dispatch(makeCtx({ event: "COMMENT_GET" } as TkRequestBody))).rejects.toThrow(
      /事件 COMMENT_GET 的处理器尚未注册/,
    );
  });

  it("switch 全量枚举 24 个常规事件 + 3 个兼容分支（清单完整性）", async () => {
    // 从源码静态核对 switch 分支数（26 事件清单守卫）
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../src/core/dispatcher.ts", import.meta.url), "utf8");
    const caseCount = source.match(/case [A-Z_]+:/g)?.length ?? 0;
    expect(caseCount).toBe(27);
  });
});

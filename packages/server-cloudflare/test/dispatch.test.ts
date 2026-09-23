/**
 * POST_SUBMIT 派发测试（`ctx.waitUntil` 通路 + 无执行上下文时的降级）。
 */
import { describe, expect, it, vi } from "vitest";
import { getPostSubmitService, setPostSubmitService } from "@twikoojs/common";
import type { PipelineContext, PostSubmitService } from "@twikoojs/common";
import { createCloudflareDispatcher } from "../src/dispatch";

/** 造一个只带 dispatch 所需字段的上下文 */
function makeCtx(options: { executionCtx?: { waitUntil(promise: Promise<unknown>): void } } = {}) {
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), verbose: vi.fn(), requestId: "t" };
  const ctx = {
    request: { raw: options.executionCtx ? { executionCtx: options.executionCtx } : {} },
    logger,
  } as unknown as PipelineContext;
  return { ctx, logger };
}

/** 评论（派发只透传） */
const comment = { _id: "c1" };

describe("createCloudflareDispatcher", () => {
  it("有 executionCtx：副作用交给 waitUntil，dispatch 立即 resolve（不等副作用）", async () => {
    const previous = getPostSubmitService();
    /** 受控的副作用：手动决定何时完成 */
    let release: () => void = () => {};
    const service: PostSubmitService = () =>
      new Promise((resolve) => {
        release = () => resolve({ code: 0 });
      });
    setPostSubmitService(service);
    try {
      const pending: Promise<unknown>[] = [];
      const { ctx } = makeCtx({ executionCtx: { waitUntil: (p) => pending.push(p) } });
      await createCloudflareDispatcher().dispatch(comment, ctx);
      // dispatch 已返回，但副作用尚未完成 → 确实没等
      expect(pending).toHaveLength(1);
      release();
      await Promise.all(pending);
    } finally {
      setPostSubmitService(previous);
    }
  });

  it("无 executionCtx（离线调用）：仍执行副作用，异常记进请求日志而不外抛", async () => {
    const previous = getPostSubmitService();
    const error = new Error("boom");
    setPostSubmitService(async () => {
      throw error;
    });
    try {
      const { ctx, logger } = makeCtx();
      await expect(createCloudflareDispatcher().dispatch(comment, ctx)).resolves.toBeUndefined();
      // 后台 promise 的 catch 需要一轮微任务
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(logger.error).toHaveBeenCalledWith("POST_SUBMIT 失败", "boom");
    } finally {
      setPostSubmitService(previous);
    }
  });

  it("副作用同步抛错时不冒泡到 COMMENT_SUBMIT（评论已入库，不能因此报错）", async () => {
    const previous = getPostSubmitService();
    setPostSubmitService((() => {
      throw new Error("sync boom");
    }) as unknown as PostSubmitService);
    try {
      const { ctx, logger } = makeCtx({ executionCtx: { waitUntil: vi.fn() } });
      await expect(createCloudflareDispatcher().dispatch(comment, ctx)).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith("POST_SUBMIT 派发失败", "sync boom");
    } finally {
      setPostSubmitService(previous);
    }
  });
});

/**
 * Vercel POST_SUBMIT 派发测试（waitUntil 托管 HTTP 自调用）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PipelineContext } from "@twikoojs/common";
import { createVercelPostSubmitDispatcher } from "../src/dispatch";

/** 造一个只带 dispatcher 所需字段的上下文 */
function makeCtx() {
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), verbose: vi.fn(), requestId: "t" };
  return { ctx: { config: {}, logger } as unknown as PipelineContext, logger };
}

/** 评论（dispatcher 只负责透传） */
const comment = { _id: "c1" };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("createVercelPostSubmitDispatcher", () => {
  it("自调用交给 waitUntil，dispatch 不等待 HTTP 完成", async () => {
    let release: () => void = () => {};
    const post = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const pending: Promise<unknown>[] = [];
    const dispatcher = createVercelPostSubmitDispatcher({
      post,
      getDefer: () => (promise) => {
        pending.push(promise);
      },
    });
    const { ctx } = makeCtx();
    vi.stubEnv("TWIKOO_SELF_URL", "https://example.vercel.app/api/twikoo");

    await expect(dispatcher.dispatch(comment, ctx)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledOnce();
    expect(pending).toHaveLength(1);

    release();
    await Promise.all(pending);
  });

  it("后台自调用失败：写日志但不影响已提交评论", async () => {
    const pending: Promise<unknown>[] = [];
    const dispatcher = createVercelPostSubmitDispatcher({
      post: vi.fn(async () => {
        throw new Error("network failed");
      }),
      getDefer: () => (promise) => {
        pending.push(promise);
      },
    });
    const { ctx, logger } = makeCtx();
    vi.stubEnv("TWIKOO_SELF_URL", "https://example.vercel.app/api/twikoo");

    await dispatcher.dispatch(comment, ctx);
    await Promise.all(pending);
    expect(logger.error).toHaveBeenCalledWith("POST_SUBMIT 后台派发失败", "network failed");
  });

  it("旧运行时无 waitUntil：保留 5 秒有界等待兼容语义", async () => {
    vi.useFakeTimers();
    const dispatcher = createVercelPostSubmitDispatcher({
      post: vi.fn(() => new Promise<void>(() => {})),
      getDefer: () => undefined,
      timeoutMs: 20,
    });
    const { ctx } = makeCtx();
    vi.stubEnv("TWIKOO_SELF_URL", "https://example.vercel.app/api/twikoo");

    let resolved = false;
    const dispatching = dispatcher.dispatch(comment, ctx).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    await dispatching;
    expect(resolved).toBe(true);
  });
});

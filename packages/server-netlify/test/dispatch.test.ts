/**
 * Netlify POST_SUBMIT 派发测试（现代 waitUntil 与旧入口兼容降级）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PipelineContext } from "@twikoojs/common";
import { createNetlifyPostSubmitDispatcher } from "../src/dispatch";

/** 造一个只带 dispatcher 所需字段的上下文 */
function makeCtx(rawUrl?: string) {
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), verbose: vi.fn(), requestId: "t" };
  return {
    ctx: {
      config: {},
      logger,
      request: { raw: rawUrl ? { rawUrl } : undefined },
    } as unknown as PipelineContext,
    logger,
  };
}

/** 评论（dispatcher 只负责透传） */
const comment = { _id: "c1" };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("createNetlifyPostSubmitDispatcher", () => {
  it("现代入口：自调用交给 waitUntil，dispatch 不等待 HTTP 完成", async () => {
    let release: () => void = () => {};
    const post = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const pending: Promise<unknown>[] = [];
    const dispatcher = createNetlifyPostSubmitDispatcher({
      post,
      getWaitUntil: () => (promise) => {
        pending.push(promise);
      },
    });
    const { ctx } = makeCtx();
    vi.stubEnv("TWIKOO_SELF_URL", "https://example.netlify.app/.netlify/functions/twikoo");

    await expect(dispatcher.dispatch(comment, ctx)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledOnce();
    expect(pending).toHaveLength(1);

    release();
    await Promise.all(pending);
  });

  it("Deploy Preview：优先使用当前请求 origin，不回落生产 URL", async () => {
    const pending: Promise<unknown>[] = [];
    const post = vi.fn<
      (
        url: string,
        data?: unknown,
        config?: { headers?: Record<string, string> },
      ) => Promise<undefined>
    >(async () => undefined);
    const dispatcher = createNetlifyPostSubmitDispatcher({
      post,
      getWaitUntil: () => (promise) => {
        pending.push(promise);
      },
    });
    const { ctx } = makeCtx(
      "https://deploy-preview-42--twikoo-test.netlify.app/.netlify/functions/twikoo",
    );
    vi.stubEnv("URL", "https://twikoo-production.netlify.app");

    await dispatcher.dispatch(comment, ctx);
    await Promise.all(pending);

    expect(post.mock.calls[0]?.[0]).toBe(
      "https://deploy-preview-42--twikoo-test.netlify.app/.netlify/functions/twikoo",
    );
  });

  it("后台自调用失败：写日志但不影响已提交评论", async () => {
    const error = new Error("network failed");
    const pending: Promise<unknown>[] = [];
    const dispatcher = createNetlifyPostSubmitDispatcher({
      post: vi.fn(async () => {
        throw error;
      }),
      getWaitUntil: () => (promise) => {
        pending.push(promise);
      },
    });
    const { ctx, logger } = makeCtx();
    vi.stubEnv("TWIKOO_SELF_URL", "https://example.netlify.app/.netlify/functions/twikoo");

    await dispatcher.dispatch(comment, ctx);
    await Promise.all(pending);
    expect(logger.error).toHaveBeenCalledWith("POST_SUBMIT 后台派发失败", "network failed");
  });

  it("旧入口无 waitUntil：保留 5 秒有界等待兼容语义", async () => {
    vi.useFakeTimers();
    const post = vi.fn(() => new Promise<void>(() => {}));
    const dispatcher = createNetlifyPostSubmitDispatcher({
      post,
      getWaitUntil: () => undefined,
      timeoutMs: 20,
    });
    const { ctx } = makeCtx();
    vi.stubEnv("TWIKOO_SELF_URL", "https://example.netlify.app/.netlify/functions/twikoo");

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

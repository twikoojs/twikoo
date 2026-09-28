/**
 * 通过 ctx.waitUntil 托管垃圾检测与通知，避免等待耗时操作或让其失败影响已保存的评论。
 * 后台执行仍受 Workers 的 30 秒窗口与 CPU 上限约束；MongoDB 收尾必须等待实际任务。
 */
import { getPostSubmitService } from "@twikoojs/common";
import type { PostSubmitDispatcher, PipelineContext, TkResponseBody } from "@twikoojs/common";

/** 派发所需的最小平台上下文面（取自 `TkRequest.raw`） */
interface DispatcherRawPayload {
  /** Workers 执行上下文（`waitUntil` 的来源） */
  executionCtx?: {
    /**
     * 托管一个后台 promise（响应返回后继续执行）
     * @param promise 待托管 promise
     */
    waitUntil(promise: Promise<unknown>): void;
  };
}

/**
 * 创建 Cloudflare 形态的 POST_SUBMIT 派发器。
 *
 * 取不到 `executionCtx` 时（离线调用、单测、非 Workers 宿主）退化为
 * `scaffoldAdapters` 的默认语义：进程内直调、不等待。此时副作用能否跑完取决于宿主，
 * **不静默丢弃**——异常会记进请求日志。
 * @returns 派发端口实现
 */
export function createCloudflareDispatcher(): PostSubmitDispatcher {
  return {
    /**
     * 派发后置副作用
     * @param comment 已入库的评论
     * @param ctx 当前请求上下文
     */
    dispatch(comment, ctx: PipelineContext): Promise<void> {
      /** 副作用 promise（含兜底日志；失败不影响 COMMENT_SUBMIT 的返回） */
      let running: Promise<TkResponseBody>;
      try {
        running = getPostSubmitService()(comment, ctx);
      } catch (e) {
        ctx.logger.error("POST_SUBMIT 派发失败", e instanceof Error ? e.message : String(e));
        return Promise.resolve();
      }
      const guarded = running.catch((e: unknown) => {
        ctx.logger.error("POST_SUBMIT 失败", e instanceof Error ? e.message : String(e));
        return { code: 0 };
      });
      const executionCtx = (ctx.request.raw as DispatcherRawPayload | undefined)?.executionCtx;
      if (typeof executionCtx?.waitUntil === "function") {
        executionCtx.waitUntil(guarded);
      }
      return Promise.resolve();
    },
  };
}

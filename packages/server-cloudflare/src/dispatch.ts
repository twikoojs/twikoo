/**
 * POST_SUBMIT 派发（Cloudflare Workers 的 `ctx.waitUntil` 形态）。
 *
 * `COMMENT_SUBMIT` 保存评论后，垃圾检测 + 三路通知这条耗时链**必须移出本次请求的
 * 执行预算**（否则用户提交要等整条链跑完；超时还会让「已入库的评论」报错，用户重试
 * 又产生重复评论）。各平台的移出机制不同（见 `@twikoojs/common` 的
 * `ports/post-submit.ts` 对照表），Cloudflare 这里用的是 **`waitUntil`**：
 *
 * - `waitUntil(promise)` 把 promise 交给 Workers 运行时托管，**响应可以在它完成前返回**，
 *   而运行时保证它继续执行（不计入响应延迟）；
 * - 与 1.x twikoo-cloudflare 的 `Promise.race([postSubmit, 5s 超时])` 相比是**改进**：
 *   1.x 那个 5 秒竞速只是「不等了」，副作用仍挂在本次请求的生命周期上，
 *   Worker 实例被回收时会被掐断；`waitUntil` 才真正给了它独立的执行窗口。
 *
 * 注意仍受 Workers 的平台上限约束：`waitUntil` 最长可把实例续命到 30 秒（且受 CPU
 * 时间限制），因此**慢速外部依赖（Akismet / 腾讯云文本安全）在本适配器里是关闭的**
 * （见 `main.ts` 的能力声明），只留 HTTP 短信道通知与 LLM 之外的轻量检测。
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
        return Promise.resolve();
      }
      void guarded;
      return Promise.resolve();
    },
  };
}

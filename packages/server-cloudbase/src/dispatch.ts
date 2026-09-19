/**
 * CloudBase 的 POST_SUBMIT 派发实现（规范「后置副作用异步语义」）。
 *
 * **1.x 语义对齐**：`src/server/function/twikoo/index.js` 的 `commentSubmit`
 * 保存评论后执行
 *
 * ```js
 * await app.callFunction({ name: context.function_name,
 *   data: { event: 'POST_SUBMIT', comment } }, { timeout: 300 })
 * ```
 *
 * ——用 **300ms 的极短 timeout** 把 `callFunction` 变成「异步」：请求已经发出，
 * 本实例不再等待，被调用的实例在自己的时间预算里跑完垃圾检测与通知。这样
 * 用户请求可以立即返回，也不会因为整条副作用链超出云函数超时上限而让
 * 「评论已入库」变成客户端错误。
 *
 * **为什么放在适配器**：`callFunction` 是 CloudBase 专有 API，common 不应感知；
 * 副作用链本身仍在 common 的 postSubmit 服务里。
 */
import { RECURSION_HEADER, getRecursionToken, type PostSubmitDispatcher } from "@twikoojs/common";
import type { TcbAppLike, TcbContextLike } from "./types";

/** 递归调用的 timeout（毫秒）。1.x 取值，仅用于「不再等待」，不是副作用的上限 */
const CALL_TIMEOUT_MS = 300;

/**
 * 创建 CloudBase 的派发实现。
 * @param app CloudBase SDK app 实例（提供 callFunction）
 * @param context 本次调用的云函数上下文（取 function_name）
 * @returns POST_SUBMIT 派发实现
 */
export function createCloudBaseDispatcher(
  app: TcbAppLike,
  context?: TcbContextLike,
): PostSubmitDispatcher {
  return {
    /**
     * 递归自调用本云函数执行 POST_SUBMIT（不等副作用完成）。
     * @param comment 已入库的评论
     * @param ctx 当前请求上下文
     */
    async dispatch(comment, ctx): Promise<void> {
      const name = process.env.TCB_FUNCTION_NAME ?? context?.function_name;
      if (!name) {
        ctx.logger.warn(
          "POST_SUBMIT 派发跳过：未取到云函数名（context.function_name / TCB_FUNCTION_NAME）",
        );
        return;
      }
      try {
        await app.callFunction(
          {
            name,
            data: {
              event: "POST_SUBMIT",
              comment,
              /**
               * 转发原请求头（被调用实例据此解析客户端 IP，语义与用户请求一致），
               * 并附上内部派发令牌——POST_SUBMIT 处理器会校验它，拒绝外部调用。
               */
              headers: {
                ...ctx.request.headers,
                [RECURSION_HEADER]: getRecursionToken(ctx.config),
              },
            },
          },
          { timeout: CALL_TIMEOUT_MS },
        );
      } catch {
        // 1.x 语义：300ms 超时是「异步化」手段——超时说明目标实例已在执行，属预期
        ctx.logger.verbose("POST_SUBMIT 已派出（本实例不再等待）");
      }
    },
  };
}

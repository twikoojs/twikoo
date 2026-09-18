/**
 * POST_SUBMIT 事件处理器（§6.6 后置副作用链的执行入口）。
 *
 * 本文件**不是**兼容分支的收尾，而是后置副作用在「独立执行单元」中的入口；
 * 兼容性只是它的副作用之一（1.x vercel 本来就把 POST_SUBMIT 当可调用事件）。
 */
import type { CommentDoc } from "../ports/database";
import type { EventHandler } from "../core/types";
import { getPostSubmitService } from "../services/post-submit";
import { getRecursionToken, RECURSION_HEADER } from "../ports/post-submit";
import { RES_CODE } from "../utils/constants";

/**
 * POST_SUBMIT：执行 COMMENT_SUBMIT 之后的后置副作用链（垃圾检测 → 回写结果 →
 * 邮件/IM 通知）。
 *
 * **它不是废弃的兼容分支，不计划移除。** 它是「把耗时副作用移出用户请求预算」
 * 的承载机制：
 *
 * - 单次执行平台（cloudbase / vercel / netlify / aws-lambda）：COMMENT_SUBMIT
 *   保存评论后，由适配器的派发端口把本事件送到**另一个执行单元**
 *   （`callFunction` / HTTP 自调用 / Lambda Invoke Event），副作用因此拥有
 *   自己的执行时间预算——用户请求可以立即返回，云函数超时也不会让「评论已
 *   入库」变成客户端错误。
 * - 常驻进程平台（self-hosted / deta）与 eo-makers：适配器直接进程内调用
 *   同一个 postSubmit 服务，不经本事件。
 *
 * **防外部滥用**：本事件若允许外部直接调用，任何人都能凭空触发垃圾检测与
 * 邮件/IM 通知。故沿用 1.x 的 `x-twikoo-recursion` 令牌校验——只有携带内部
 * 派发令牌（{@link getRecursionToken}）的请求才执行，其余一律 1403 拒绝。
 *
 * @param ctx 请求上下文（body.comment 为目标评论）
 * @returns postSubmit 服务响应体；令牌不符时返回 1403
 */
export const postSubmitEvent: EventHandler = async (ctx) => {
  if (ctx.request.headers[RECURSION_HEADER] !== getRecursionToken(ctx.config)) {
    ctx.logger.warn("POST_SUBMIT 被外部调用，已拒绝（缺少有效的内部派发令牌）");
    return { code: RES_CODE.FORBIDDEN };
  }
  const comment = (ctx.request.body.comment ?? {}) as CommentDoc;
  return getPostSubmitService()(comment, ctx);
};

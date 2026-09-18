/**
 * postSubmit 服务（§6.6 后置副作用链的唯一实现）。
 *
 * 职责：执行「后置垃圾检测 → 回写检测结果 → 发送评论通知」这条耗时链。
 * 它**只是逻辑**，不关心自己被谁触发、在哪个执行单元里运行：
 *
 * - 单次执行平台（cloudbase / vercel / netlify / aws-lambda）：由适配器的
 *   {@link PostSubmitDispatcher} 递归自调用，经 POST_SUBMIT 事件处理器进入；
 * - 常驻进程平台（self-hosted / deta）与 eo-makers：由适配器的派发端口
 *   进程内直接调用，不 await。
 *
 * 两条路径调用的是同一个服务，因此副作用完全一致。
 *
 * 1.x 对照：vercel 在 COMMENT_SUBMIT 成功后用 **HTTP 递归**（自调用
 * POST_SUBMIT 事件 + `x-twikoo-recursion` 头）异步执行本链；CloudBase 用
 * `app.callFunction`；self-hosted / eo-makers 进程内直调。三者实现各自复制。
 * 2.0 把「链本身」收敛到本服务，「触发方式」收敛到适配器的派发端口。
 */
import type { CommentDoc } from "../ports/database";
import type { PipelineContext } from "../core/types";
import type { TkResponseBody } from "../ports/response";
import { RES_CODE } from "../utils/constants";

/**
 * postSubmit 服务签名：入参为已保存的评论与请求上下文，执行
 * 「后置垃圾检测 + 保存检测结果 + 发送评论通知」副作用。
 */
export type PostSubmitService = (
  comment: CommentDoc,
  ctx: PipelineContext,
) => Promise<TkResponseBody>;

/**
 * 默认实现（T13 接缝）：记录日志并返回成功，不执行任何副作用。
 * T18 以真实实现覆写（postCheckSpam + saveSpamCheckResult + sendNotice）。
 * @param comment 已保存的评论
 * @param ctx 请求上下文
 * @returns 成功响应体（Promise 形态与真实服务签名一致）
 */
const noopPostSubmit: PostSubmitService = (comment, ctx) => {
  ctx.logger.info("postSubmit 服务尚未接线（T18），跳过垃圾检测与通知", {
    id: comment._id,
  });
  return Promise.resolve({ code: RES_CODE.SUCCESS });
};

/** 当前生效的 postSubmit 服务实现（setPostSubmitService 可覆写） */
let current: PostSubmitService = noopPostSubmit;

/**
 * 覆写 postSubmit 服务实现（T18 注入真实实现；测试注入 spy）。
 * @param service 新的服务实现
 */
export function setPostSubmitService(service: PostSubmitService): void {
  current = service;
}

/**
 * 获取当前 postSubmit 服务实现（COMMENT_SUBMIT 成功路径与 POST_SUBMIT
 * 兼容分支统一经此调用，保证副作用同源）。
 * @returns 当前服务实现
 */
export function getPostSubmitService(): PostSubmitService {
  return current;
}

/**
 * postSubmit 服务（D-4 双支持的核心接缝，规范 §6.6）。
 *
 * 1.x 现状：vercel 在 COMMENT_SUBMIT 成功后通过 **HTTP 递归**（自调用
 * POST_SUBMIT 事件 + x-twikoo-recursion 头）异步执行垃圾检测与通知；
 * self-hosted / eo-makers 直接进程内调用 postSubmit。三者实现各自复制。
 *
 * 2.0 统一：postSubmit 为**进程内服务**——COMMENT_SUBMIT 成功后直接调用
 * （不再 HTTP 递归）；POST_SUBMIT 兼容事件分支（@deprecated，2.2.0 移除）
 * 也转发到本服务，保证「事件可调用」行为与「成功副作用」完全一致。
 *
 * T13 接缝说明：本波提供默认空实现与服务注册机制（沿用 1.x
 * setCustomLibs 的覆写范式）；真实的垃圾检测（postCheckSpam）+ 通知
 * （sendNotice）实现随 T18 注入。
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

/**
 * POST_SUBMIT 兼容事件分支（D-4 双支持，规范 §6.6）。
 */
import type { CommentDoc } from "../ports/database";
import type { EventHandler } from "../core/types";
import { getPostSubmitService } from "../services/post-submit";

/**
 * POST_SUBMIT 事件处理：转发到与 COMMENT_SUBMIT 成功路径**同一个**
 * postSubmit 服务（垃圾检测 + 通知），保证副作用完全一致。
 *
 * 1.x 语义备注：vercel 曾要求 x-twikoo-recursion 头（防外部滥用）——那是
 * HTTP 递归机制的守卫；2.0 改为进程内直调后该机制不复存在，本分支即
 * 「可调用事件」的完整行为（D-4：vercel 现有行为 100% 保持）。
 *
 * @deprecated 2.0 起定位为 COMMENT_SUBMIT 成功后的内部钩子，本事件分支仅为
 *   兼容保留，计划 2.2.0 移除（AGENTS.md 待办登记）。
 * @param ctx 请求上下文（body.comment 为目标评论）
 * @returns postSubmit 服务响应体
 */
export const postSubmitEvent: EventHandler = async (ctx) => {
  const comment = (ctx.request.body.comment ?? {}) as CommentDoc;
  return getPostSubmitService()(comment, ctx);
};

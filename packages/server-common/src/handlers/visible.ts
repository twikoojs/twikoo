/**
 * VISIBLE 兼容事件分支（D-4 双支持，规范 §6.6）。
 */
import type { EventHandler } from "../core/types";
import { forwardAdminCommentGet } from "./forward-admin-comment-get";

/**
 * VISIBLE 事件处理：等价于 COMMENT_GET_FOR_ADMIN 携带 `type: "VISIBLE"`
 * （只看正常/可见评论）。
 *
 * @deprecated 2.0 起 VISIBLE 统一为 COMMENT_GET_FOR_ADMIN 的 type 参数，
 *   本独立事件分支仅为兼容保留，计划 2.2.0 移除（AGENTS.md 待办登记）。
 * @param ctx 请求上下文
 * @returns 管理员评论列表响应体
 */
export const visibleEvent: EventHandler = (ctx) => forwardAdminCommentGet(ctx, "VISIBLE");

/**
 * HIDDEN / VISIBLE 兼容分支的共享转发逻辑（D-4 双支持，规范 §6.6）。
 */
import { COMMENT_GET_FOR_ADMIN } from "@twikoojs/shared";
import type { PipelineContext } from "../core/types";
import { resolveHandler } from "../core/handler-registry";
import { HandlerNotRegisteredError } from "../core/errors";
import type { TkRequestBody } from "../ports/request";
import type { TkResponseBody } from "../ports/response";

/**
 * 把 HIDDEN / VISIBLE 兼容事件转发到 COMMENT_GET_FOR_ADMIN 处理器：
 * 派生请求体注入 `type` 参数（与客户端显式传 `type` 的行为完全等价），
 * 其余字段原样透传（per / page / keyword 等筛选条件不受影响）。
 * @param ctx 原请求上下文
 * @param type 兼容事件对应的筛选类型（仅 "HIDDEN" | "VISIBLE"）
 * @returns COMMENT_GET_FOR_ADMIN 的响应体
 */
export async function forwardAdminCommentGet(
  ctx: PipelineContext,
  type: "HIDDEN" | "VISIBLE",
): Promise<TkResponseBody> {
  const handler = resolveHandler(COMMENT_GET_FOR_ADMIN);
  if (!handler) throw new HandlerNotRegisteredError(COMMENT_GET_FOR_ADMIN);
  const body: TkRequestBody = { ...ctx.request.body, event: COMMENT_GET_FOR_ADMIN, type };
  return handler({ ...ctx, request: { ...ctx.request, body } });
}

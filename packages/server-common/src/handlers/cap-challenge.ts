/**
 * CAP_CHALLENGE / CAP_REDEEM 事件处理器（1.x capChallenge/capRedeem 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { capChallenge, capRedeem } from "../services/cap";

/**
 * CAP_CHALLENGE：签发内嵌 Cap 挑战（未启用内嵌 Cap 返回 FAIL）。
 * @param ctx 请求上下文
 * @returns 挑战响应
 */
export const capChallengeEvent: EventHandler = (ctx) =>
  capChallenge({ config: ctx.config, db: ctx.adapters.database });

/**
 * CAP_REDEEM：兑换内嵌 Cap 挑战换取通行 token。
 * @param ctx 请求上下文
 * @returns 兑换响应
 */
export const capRedeemEvent: EventHandler = (ctx) =>
  capRedeem({
    config: ctx.config,
    db: ctx.adapters.database,
    body: ctx.request.body as { token?: string; solutions?: unknown },
  });

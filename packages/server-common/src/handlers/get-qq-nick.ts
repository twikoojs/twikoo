/**
 * GET_QQ_NICK 事件处理器（1.x qqNickGet 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import { getQQNick } from "../services/comment-dto";

/**
 * 获取 QQ 昵称（QQ_API_KEY 鉴权可配；失败返回 null 不抛错）。
 * @param ctx 请求上下文
 * @returns 昵称响应
 */
export const getQQNickEvent: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  try {
    const event = ctx.request.body;
    validate(event, ["qq"]);
    const nick = await getQQNick(event.qq as string, ctx.config.QQ_API_KEY as string);
    res.code = RES_CODE.SUCCESS;
    res.nick = nick;
  } catch (e) {
    res.code = RES_CODE.FAIL;
    res.message = e instanceof Error ? e.message : String(e);
  }
  return res;
};

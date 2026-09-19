/**
 * COMMENT_LIKE 事件处理器（1.x commentLike + like 语义对齐：赞/踩/取消）。
 */
import type { CommentDoc } from "../ports/database";
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";

/**
 * 点赞 / 反对 / 取消（同一 uid 重复操作为取消；赞踩互斥）。
 * @param ctx 请求上下文
 * @returns 更新响应
 */
export const commentLike: EventHandler = async (ctx) => {
  const event = ctx.request.body;
  validate(event, ["id"]);
  const uid = ctx.accessToken;
  const type = (event.type as string) || "up";
  const db = ctx.adapters.database;
  const comment = await db.getComment(event.id as string);
  const commentData: Partial<CommentDoc> = comment ?? {};
  const ups = commentData.ups ?? [];
  const downs = commentData.downs ?? [];
  let newUps = [...ups];
  let newDowns = [...downs];
  if (type === "up") {
    if (ups.includes(uid)) {
      newUps = ups.filter((item) => item !== uid);
    } else {
      newUps.push(uid);
      newDowns = downs.filter((item) => item !== uid);
    }
  } else if (type === "down") {
    if (downs.includes(uid)) {
      newDowns = downs.filter((item) => item !== uid);
    } else {
      newDowns.push(uid);
      newUps = ups.filter((item) => item !== uid);
    }
  }
  if (comment) {
    await db.updateComment(comment._id as string, { ups: newUps, downs: newDowns });
  }
  return { code: RES_CODE.SUCCESS, updated: 1 };
};

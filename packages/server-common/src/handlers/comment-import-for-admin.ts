/**
 * COMMENT_IMPORT_FOR_ADMIN 事件处理器（1.x commentImportForAdmin 语义对齐）。
 * 导入日志经聚合后随响应 res.log 回传（1.x logText 语义，requestId 标注）。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import { isAdmin } from "../services/user";
import {
  commentImportArtalk,
  commentImportArtalk2,
  commentImportDisqus,
  commentImportTwikoo,
  commentImportValine,
  jsonParse,
  parseXml,
} from "../services/import";

/**
 * 管理员导入评论（valine/disqus/artalk/artalk2/twikoo 五格式）。
 * @param ctx 请求上下文
 * @returns 导入响应（res.log 含全过程日志）
 */
export const commentImportForAdmin: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  let logText = "";
  /** 导入日志（时间戳标注，随响应回传） */
  const log = (message: string): void => {
    logText += `${new Date().toLocaleString()} ${message}\n`;
  };
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  try {
    const event = ctx.request.body;
    validate(event, ["source", "file"]);
    log(`开始导入 ${String(event.source)}`);
    let comments;
    switch (event.source) {
      case "valine": {
        const valineDb = jsonParse(String(event.file));
        comments = await commentImportValine(valineDb, log);
        break;
      }
      case "disqus": {
        const disqusDb = await parseXml(String(event.file));
        comments = await commentImportDisqus(disqusDb, log);
        break;
      }
      case "artalk": {
        const artalkDb = jsonParse(String(event.file));
        comments = await commentImportArtalk(artalkDb, log, ctx.adapters.capabilities);
        break;
      }
      case "artalk2": {
        const artalkDb = jsonParse(String(event.file));
        comments = await commentImportArtalk2(artalkDb, log, ctx.adapters.capabilities);
        break;
      }
      case "twikoo": {
        const twikooDb = jsonParse(String(event.file));
        comments = await commentImportTwikoo(twikooDb, log);
        break;
      }
      default:
        throw new Error(`不支持 ${String(event.source)} 的导入，请更新 Twikoo 云函数至最新版本`);
    }
    if (comments) {
      await ctx.adapters.database.bulkAddComments(comments);
      log(`导入成功 ${comments.length} 条评论`);
    }
  } catch (e) {
    log(e instanceof Error ? e.message : String(e));
  }
  res.code = RES_CODE.SUCCESS;
  res.log = logText;
  ctx.logger.info(logText);
  return res;
};

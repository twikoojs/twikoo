/**
 * COMMENT_GET 事件处理器（1.x commentGet 语义对齐）。
 *
 * 可见性：访客可见「非垃圾」+「本人的全部评论」（1.x $or 的服务层双查合并，
 * 见 comment-query.ts）；管理员 HIDE_SPAM=true 时仅见非垃圾。主楼 rid ABSENT +
 * 置顶分离 + 流式分页（多读 1 条判 more）+ 回复按 rid 归组，parseComment 拼装。
 */
import { ABSENT, NOT } from "../ports/database";
import type { CommentDoc } from "../ports/database";
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import {
  getSearchKeyword,
  queryVisibleComments,
  searchVisibleComments,
} from "../services/comment-query";
import { getUrlQuery, parseComment } from "../services/comment-dto";
import { isAdmin } from "../services/user";

/**
 * COMMENT_GET：读取页面评论（含回复、置顶、分页、排序）。
 * @param ctx 请求上下文
 * @returns 评论列表响应（data/more/count）
 */
export const commentGet: EventHandler = async (ctx) => {
  const event = ctx.request.body;
  validate(event, ["url"]);
  if (getSearchKeyword(event)) {
    // 带关键词走搜索形态（1.x commentSearch）
    return searchVisibleComments(ctx);
  }
  const config = ctx.config;
  const uid = ctx.accessToken;
  const isAdminUser = isAdmin(config, uid);
  const db = ctx.adapters.database;
  const pageSize = parseInt(String(config.COMMENT_PAGE_SIZE ?? "")) || 8;
  const sort = (event.sort as string) || "newest";
  let more = false;
  /** 查询条件：url 多形态 + 顶级评论 */
  let condition: Record<string, unknown> = {
    url: { $in: getUrlQuery(event.url as string) },
    rid: ABSENT,
  };
  // 读取总条数（1.x 语义：与主查询同可见性，先于置顶剔除）
  const count = await queryVisibleCount(ctx, condition);
  if (event.before !== undefined && event.before !== null) {
    condition = { ...condition, created: event.before };
  }
  // 不包含置顶
  const mainCondition = { ...condition, top: { [NOT]: true } };
  /** 排序（newest/oldest/popular，1.x 对齐） */
  const sortOrder: Record<string, 1 | -1> =
    sort === "oldest"
      ? { created: 1 }
      : sort === "popular"
        ? { ups: -1, created: -1 }
        : { created: -1 };
  let main = await queryVisibleComments(db, mainCondition, uid, isAdminUser, config, {
    sort: sortOrder,
    limit: pageSize + 1,
  });
  if (main.length > pageSize) {
    // 还有更多评论（多读的 1 条剔除，1.x 流式分页）
    more = true;
    main = main.slice(0, pageSize);
  }
  let top: CommentDoc[] = [];
  if (!config.TOP_DISABLED && !event.before) {
    // 查询置顶评论
    top = await queryVisibleComments(
      db,
      { ...mainCondition, top: true },
      uid,
      isAdminUser,
      config,
      { sort: { created: -1 } },
    );
  }
  main = [...top, ...main];
  // 读取回复楼（可见性同主查）
  const reply = await queryVisibleComments(
    db,
    { rid: { $in: main.map((item) => String(item._id)) } } as never,
    uid,
    isAdminUser,
    config,
  );
  const data = await parseComment([...main, ...reply], uid, config, ctx.adapters.capabilities);
  return {
    code: RES_CODE.SUCCESS,
    data,
    more,
    count,
  };
};

/**
 * 可见性计数（1.x count 的 $or 语义：取回命中 id 精确去重后计数）。
 * @param ctx 请求上下文
 * @param condition 基础条件
 * @returns 可见条数
 */
async function queryVisibleCount(
  ctx: Parameters<EventHandler>[0],
  condition: Record<string, unknown>,
): Promise<number> {
  const db = ctx.adapters.database;
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (isAdminUser && ctx.config.HIDE_SPAM !== "true") {
    return db.countComments(condition as never);
  }
  const [a, b] = await Promise.all([
    db.getComments({ ...condition, isSpam: { [NOT]: true } }),
    db.getComments({ ...condition, uid: ctx.accessToken }),
  ]);
  const seen = new Set<string>();
  for (const doc of [...a, ...b]) seen.add(String(doc._id));
  return seen.size;
}

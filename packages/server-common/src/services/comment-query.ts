/**
 * 评论查询共享服务（1.x getSearchKeyword/getCommentSearchCondition/
 * commentSearch/getCommentQuery 的语义收拢，COMMENT_GET 与
 * COMMENT_GET_FOR_ADMIN 共用）。
 */
import { NOT } from "../ports/database";
import type { CommentDoc, ConfigData, Database, SemanticQuery } from "../ports/database";
import type { PipelineContext } from "../core/types";
import { isAdmin } from "./user";
import { getUrlsQuery, parseComment } from "./comment-dto";

/**
 * 提取搜索关键词（1.x getSearchKeyword 对齐：字符串校验 + 100 字符上限）。
 * @param event 请求体
 * @returns 关键词（无则空串）
 */
export function getSearchKeyword(event: Record<string, unknown>): string {
  const keyword = event.keyword;
  if (keyword === undefined || keyword === null) return "";
  if (typeof keyword !== "string") throw new Error("搜索关键词必须是字符串");
  const trimmed = keyword.trim();
  if (trimmed.length > 100) throw new Error("搜索关键词不能超过 100 个字符");
  return trimmed;
}

/**
 * 访客搜索可匹配的字段。
 *
 * 只含**本来就会随 DTO 下发给访客**的字段（`nick` / `link` / `comment` /
 * `url` / `href`），因此命中与否不泄露任何额外信息。
 */
const VISITOR_KEYWORD_FIELDS = ["nick", "link", "comment", "url", "href"] as const;

/**
 * 管理员搜索可额外匹配的字段（`mail` / `ip`）。
 *
 * ⚠️ **绝不能用于访客搜索**：`mail` / `ip` 在 DTO 里被隐藏，但「某条评论是否
 * 命中」本身就会回答「这个邮箱/IP 是否存在」，而且子串匹配允许逐字符探测
 * （GHSA-v349-m8q5-7x2g）。管理员已在管理面板中直接看得到这两个字段，
 * 故管理端搜索保留它们不构成额外泄露。
 */
const ADMIN_KEYWORD_FIELDS = ["nick", "mail", "link", "ip", "comment", "url", "href"] as const;

/**
 * 评论字段是否命中关键词（大小写不敏感子串，1.x commentMatchesKeyword 对齐）。
 * @param comment 评论
 * @param keyword 关键词
 * @param options 匹配范围（`includeSensitive` 仅管理员搜索可置 true）
 * @returns 是否命中
 */
export function commentMatchesKeyword(
  comment: CommentDoc,
  keyword: string,
  options: { includeSensitive?: boolean } = {},
): boolean {
  const keywordLower = keyword.toLowerCase();
  const fields: readonly string[] = options.includeSensitive
    ? ADMIN_KEYWORD_FIELDS
    : VISITOR_KEYWORD_FIELDS;
  return fields.some((field) => {
    const value = comment[field];
    return typeof value === "string" ? value.toLowerCase().includes(keywordLower) : false;
  });
}

/**
 * 可见性语义展开（1.x getCommentQuery 的 $or 服务层等价形态）：
 * 管理员（未开 HIDE_SPAM）全可见；否则「非垃圾 ∪ 本人评论」双查合并去重。
 * @param db 数据库
 * @param condition 基础条件
 * @param uid 当前用户
 * @param isAdminUser 是否管理员
 * @param config 全量配置
 * @param options 查询选项（sort/limit 透传主查）
 * @returns 合并去重后的评论
 */
export async function queryVisibleComments(
  db: Database,
  condition: SemanticQuery,
  uid: string,
  isAdminUser: boolean,
  config: ConfigData,
  options?: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number },
): Promise<CommentDoc[]> {
  if (isAdminUser && config.HIDE_SPAM !== "true") {
    return db.getComments(condition, options);
  }
  // 访客 / HIDE_SPAM：非垃圾 ∪ 本人评论（1.x $or 双分支的服务层合并）
  const [notSpam, mine] = await Promise.all([
    db.getComments({ ...condition, isSpam: { [NOT]: true } }, options),
    db.getComments({ ...condition, uid }),
  ]);
  const seen = new Set<string>();
  const merged: CommentDoc[] = [];
  for (const doc of [...notSpam, ...mine]) {
    const id = String(doc._id);
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(doc);
    }
  }
  // 合并后按 sort 语义重排（等价重建库内排序）
  if (options?.sort) {
    const entries = Object.entries(options.sort);
    merged.sort((a, b) => {
      for (const [field, direction] of entries) {
        const av = (a[field] as number | undefined) ?? 0;
        const bv = (b[field] as number | undefined) ?? 0;
        const diff = av - bv;
        if (diff !== 0) return direction === -1 ? -diff : diff;
      }
      return 0;
    });
  }
  return merged;
}

/**
 * 访客搜索（1.x commentSearch 服务层形态：页内关键词过滤 + 可见性 + DTO 拼装）。
 *
 * 匹配范围**恒为访客字段集**（见 {@link VISITOR_KEYWORD_FIELDS}）：本函数由公开的
 * COMMENT_GET 触达，即便调用者恰好是管理员也不放宽——否则返回结果的条数差异仍会
 * 成为 `mail` / `ip` 的存在性预言机（GHSA-v349-m8q5-7x2g）。管理员要按邮箱/IP 检索
 * 请走 COMMENT_GET_FOR_ADMIN。
 * @param ctx 请求上下文
 * @returns 搜索结果响应
 */
export async function searchVisibleComments(ctx: PipelineContext): Promise<{
  code: number;
  data: unknown[];
  count: number;
}> {
  const event = ctx.request.body;
  const config = ctx.config;
  const uid = ctx.accessToken;
  const isAdminUser = isAdmin(config, uid);
  const keyword = getSearchKeyword(event);
  const db = ctx.adapters.database;
  const all = await db.getComments({
    url: { $in: getUrlsQuery([event.url as string]) },
  } as never);
  const matched = all.filter((c) => commentMatchesKeyword(c, keyword));  const visible = isAdminUser ? matched : matched.filter((c) => !c.isSpam || c.uid === uid);
  const data = await parseComment(visible, uid, config, ctx.adapters.capabilities);
  return { code: 0, data, count: data.length };
}

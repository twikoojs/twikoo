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
 * 可见性语义展开（1.x getCommentQuery 的 $or 服务层等价形态）：
 * 管理员（未开 HIDE_SPAM）全可见；否则「非垃圾 + 本人垃圾」双查合并，两组互斥。
 * @param db 数据库
 * @param condition 基础条件
 * @param uid 当前用户
 * @param isAdminUser 是否管理员
 * @param config 全量配置
 * @param options 查询选项（排序和读取上限同时应用于两个分支）
 * @returns 合并后的评论
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
  // 与可见性计数保持一致；分支互斥，本人正常评论不重复占用读取配额。
  const [notSpam, mySpam] = await Promise.all([
    db.getComments({ ...condition, isSpam: { [NOT]: true } }, options),
    db.getComments({ ...condition, uid, isSpam: true }, options),
  ]);
  const merged = [...notSpam, ...mySpam];
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
 * 由数据库按页面与关键词查询，再按可见性规则拼装 DTO。
 *
 * 匹配范围恒为访客字段集：本函数由公开的
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
  const matched = await db.getComments(
    { url: getUrlsQuery([event.url as string]) },
    { publicKeyword: keyword },
  );
  const visible = isAdminUser ? matched : matched.filter((c) => !c.isSpam || c.uid === uid);
  const data = await parseComment(visible, uid, config, ctx.adapters.capabilities);
  return { code: 0, data, count: data.length };
}

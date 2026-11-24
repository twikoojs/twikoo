import type { CommentDoc } from "../ports/database";

/**
 * 访客搜索可匹配的字段。
 *
 * 只含**本来就会随 DTO 下发给访客**的字段（`nick` / `link` / `comment` /
 * `url` / `href`），因此命中与否不泄露任何额外信息。
 */
export const VISITOR_KEYWORD_FIELDS = ["nick", "link", "comment", "url", "href"] as const;

/**
 * 管理员搜索可额外匹配的字段（`mail` / `ip`）。
 *
 * ⚠️ **绝不能用于访客搜索**：`mail` / `ip` 在 DTO 里被隐藏，但「某条评论是否
 * 命中」本身就会回答「这个邮箱/IP 是否存在」，而且子串匹配允许逐字符探测
 * （GHSA-v349-m8q5-7x2g）。管理员已在管理面板中直接看得到这两个字段，
 * 故管理端搜索保留它们不构成额外泄露。
 */
const ADMIN_KEYWORD_FIELDS = [...VISITOR_KEYWORD_FIELDS, "mail", "ip"] as const;

export function escapeSearchRegex(keyword: string): string {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\0", "\\x00");
}

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
  const fields = options.includeSensitive ? ADMIN_KEYWORD_FIELDS : VISITOR_KEYWORD_FIELDS;
  return fields.some((field) => {
    const value = comment[field];
    return typeof value === "string" && value.toLowerCase().includes(keywordLower);
  });
}

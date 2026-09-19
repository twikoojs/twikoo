/**
 * XSS 消毒（1.x utils/index.js sanitizeHtml 对齐：FORBID_TAGS style / FORBID_ATTR style）。
 */
import DOMPurify from "dompurify";

/**
 * 消毒 HTML（评论预览与渲染用；服务端已消毒，客户端双保险）。
 * @param html 原始 HTML
 * @returns 消毒后 HTML
 */
export function sanitizeHtml(html: unknown): string {
  return DOMPurify.sanitize(typeof html === "string" ? html : "", {
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["style"],
  });
}

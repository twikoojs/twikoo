/**
 * HTML → 纯文本工具（管理端编辑历史评论时回填 Markdown 输入框用）。
 *
 * 历史评论只存了消毒后的 HTML，没有 Markdown 原文。编辑这类评论时，把 HTML
 * 降级为纯文本再放进输入框，避免让管理员直接面对 HTML 源码。
 */
import { sanitizeHtml } from "./sanitize";

/** 不参与纯文本提取的标签（脚本/样式内容不是评论正文） */
const SKIP_TAGS = new Set(["script", "style", "noscript", "template"]);

/** 需要产生换行的块级标签（不含 br，br 单独处理） */
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "blockquote",
  "div",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "thead",
  "tr",
  "ul",
]);

/**
 * 递归收集节点文本（块级标签前后补换行，br 转换行，img 取 alt）。
 * @param node 当前节点
 * @param parts 文本片段收集器
 */
function collectText(node: Node, parts: string[]): void {
  if (node.nodeType === 3) {
    parts.push(node.nodeValue ?? "");
    return;
  }
  if (node.nodeType === 1) {
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;
    if (tag === "br") {
      parts.push("\n");
      return;
    }
    if (tag === "img") {
      parts.push(element.getAttribute("alt") ?? "");
      return;
    }
    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) parts.push("\n");
    for (const child of Array.from(node.childNodes)) collectText(child, parts);
    if (isBlock) parts.push("\n");
    return;
  }
  for (const child of Array.from(node.childNodes)) collectText(child, parts);
}

/**
 * 规范化纯文本（统一换行、去掉行尾空白与多余空行）。
 * @param text 原始文本
 * @returns 规范化文本
 */
function normalizePlainText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 把评论 HTML 转为纯文本（历史评论没有 Markdown 原文时的编辑回填）。
 * @param html 评论 HTML
 * @returns 纯文本；非字符串或空内容返回空串
 */
export function htmlToPlainText(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  const template = document.createElement("template");
  // 包一层容器再消毒：裸文本开头的片段（如 "a<br>b"）在部分 DOM 实现中
  // 会丢失首段文本，放进 body 上下文可保证解析结果与浏览器一致
  template.innerHTML = sanitizeHtml(`<div>${html}</div>`);
  const parts: string[] = [];
  collectText(template.content, parts);
  return normalizePlainText(parts.join(""));
}

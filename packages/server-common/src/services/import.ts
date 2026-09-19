/* eslint-disable @typescript-eslint/require-await --
 * 导入器与 1.x 形态一致保持异步签名（XML/消毒路径为异步），同步分支为容错形态。
 */
/**
 * 评论导入服务（1.x utils/import.js 移植；格式：Valine / Disqus / Artalk /
 * Artalk v2 / Twikoo）。
 *
 * 依赖：Disqus 解析用 xml2js；Artalk Markdown 渲染用 marked + DOMPurify
 * （库加载器动态装载，能力门：domPurify）。
 */
import type { Capabilities } from "../ports/capabilities";
import type { CommentDoc } from "../ports/database";
import { getDomPurify, getMarked, getXml2js } from "../utils/lib-loader";
import { md5 } from "../utils/crypto";
import { toStr } from "../utils/safe-str";
import { getRelativeUrl, normalizeMail } from "./comment-dto";

/** 数组形态字段（1.x ARRAY_FIELDS 对齐：兼容字符串化 JSON 存储） */
const ARRAY_FIELDS = ["like", "ups", "downs"];

/**
 * 解析可能为字符串化 JSON 的数组字段（1.x parseJsonArrayField 对齐）。
 * @param value 原始值
 * @returns 数组或原值
 */
function parseJsonArrayField(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return value;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

/**
 * 规范化 Twikoo 备份评论（1.x normalizeTwikooComment 对齐：$oid 历史 id、
 * null pid/rid 剔除、数组字段反序列化）。
 * @param comment 备份评论
 * @returns 规范化评论
 */
function normalizeTwikooComment(comment: Record<string, unknown>): Record<string, unknown> {
  const parsed = { ...comment };
  const rawId = comment._id as { $oid?: string } | string | undefined;
  if (rawId && typeof rawId === "object" && rawId.$oid) {
    parsed._id = rawId.$oid;
  }
  if (comment.pid === null) delete parsed.pid;
  if (comment.rid === null) delete parsed.rid;
  for (const field of ARRAY_FIELDS) {
    if (field in parsed) {
      parsed[field] = parseJsonArrayField(parsed[field]);
    }
  }
  return parsed;
}

/** 导入日志函数形态 */
export type ImportLog = (message: string) => void;

/**
 * 兼容 Leancloud 两种 JSON 导出格式（1.x jsonParse 对齐：整体解析失败转逐行）。
 * @param content 文件文本
 * @returns 解析结果
 */
export function jsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const results: unknown[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
      try {
        results.push(JSON.parse(line));
      } catch {
        // 跳过非法行（1.x 语义）
      }
    }
    return { results };
  }
}

/**
 * 解析 XML 文本（xml2js 动态加载）。
 * @param xml XML 文本
 * @returns 解析结果
 */
export async function parseXml(xml: string): Promise<unknown> {
  const xml2js = await getXml2js();
  return xml2js.parseStringPromise(xml);
}

/**
 * Valine 导入（1.x commentImportValine 对齐）。
 * @param valineDb 解析后的备份
 * @param log 日志函数
 * @returns 评论列表
 */
export async function commentImportValine(
  valineDb: unknown,
  log: ImportLog,
): Promise<CommentDoc[] | undefined> {
  let arr: Array<Record<string, unknown>> | undefined;
  if (Array.isArray(valineDb)) {
    arr = valineDb as Array<Record<string, unknown>>;
  } else if (valineDb && typeof valineDb === "object" && "results" in valineDb) {
    arr = (valineDb as { results: Array<Record<string, unknown>> }).results;
  }
  if (!arr) {
    log("Valine 评论文件格式有误");
    return undefined;
  }
  const comments: CommentDoc[] = [];
  log(`共 ${arr.length} 条评论`);
  for (const comment of arr) {
    try {
      comments.push({
        _id: comment.objectId as string,
        nick: comment.nick as string,
        ip: comment.ip as string,
        mail: comment.mail as string,
        mailMd5: comment.mailMd5 as string,
        isSpam: comment.isSpam as boolean,
        ua: (comment.ua as string) || "",
        link: comment.link as string,
        pid: comment.pid as string,
        rid: comment.rid as string,
        master: false,
        comment: comment.comment as string,
        url: comment.url as string,
        created: new Date(comment.createdAt as string).getTime(),
        updated: new Date(comment.updatedAt as string).getTime(),
      });
      log(`${String(comment.objectId)} 解析成功`);
    } catch (e) {
      log(`${String(comment.objectId)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`解析成功 ${comments.length} 条评论`);
  return comments;
}

/**
 * Disqus 导入（1.x commentImportDisqus 对齐：thread 定位、父链回溯根评论）。
 * @param disqusDb 解析后的 XML 对象
 * @param log 日志函数
 * @returns 评论列表
 */
export async function commentImportDisqus(
  disqusDb: unknown,
  log: ImportLog,
): Promise<CommentDoc[] | undefined> {
  const root = disqusDb as
    | {
        disqus?: {
          thread?: Array<Record<string, unknown>>;
          post?: Array<Record<string, unknown>>;
        };
      }
    | undefined;
  if (!root?.disqus?.thread || !root.disqus.post) {
    log("Disqus 评论文件格式有误");
    return undefined;
  }
  const { thread, post } = root.disqus;
  /** 字段取值辅助（XML 数组形态） */
  const at = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
  /**
   *
   */
  const attr = (v: unknown): unknown =>
    Array.isArray(v) ? (v[0] as { $?: { "dsq:id"?: string } })?.$?.["dsq:id"] : undefined;
  const comments: CommentDoc[] = [];
  /**
   *
   */
  const getParent = (p: Record<string, unknown>): Record<string, unknown> | null => {
    const parentId = attr(p.parent);
    if (!parentId) return null;
    return (
      post.find(
        (item) => (item.$ as Record<string, string> | undefined)?.["dsq:id"] === parentId,
      ) ?? null
    );
  };
  let threads: Array<{ id: unknown; url?: unknown; href?: unknown }> = [];
  try {
    threads = thread.map((t) => ({
      id: attr(t.$),
      url: at(t.id),
      href: at(t.link),
    }));
  } catch (e) {
    log(`无法读取 thread：${e instanceof Error ? e.message : String(e)}`);
    return undefined;
  }
  log(`共 ${post.length} 条评论`);
  for (const p of post) {
    const postId = attr(p.$);
    try {
      const threadId = attr(p.thread);
      const t = threads.find((item) => item.id === threadId);
      const parent = getParent(p);
      let rootPost: Record<string, unknown> | null = null;
      if (parent) {
        let grandParent: Record<string, unknown> | null = parent;
        while (true) {
          if (grandParent) rootPost = grandParent;
          else break;
          grandParent = getParent(grandParent);
        }
      }
      const threadUrl = typeof t?.url === "string" ? t.url : undefined;
      const threadHref = typeof t?.href === "string" ? t.href : undefined;
      const author = p.author as Array<{ name?: string[] }> | undefined;
      comments.push({
        _id: postId as string,
        nick: author?.[0]?.name?.[0],
        mail: "",
        link: "",
        url: threadUrl
          ? threadUrl.indexOf("http") === 0
            ? getRelativeUrl(threadUrl)
            : threadUrl
          : threadHref
            ? getRelativeUrl(threadHref)
            : undefined,
        href: threadHref,
        comment: at(p.message) as string,
        ua: "",
        ip: "",
        isSpam: at(p.isSpam) === "true" || at(p.isDeleted) === "true",
        master: false,
        pid: parent ? (parent.$ as Record<string, string> | undefined)?.["dsq:id"] : undefined,
        rid: rootPost ? (rootPost.$ as Record<string, string> | undefined)?.["dsq:id"] : undefined,
        created: new Date(at(p.createdAt) as string).getTime(),
        updated: Date.now(),
      });
      log(`${String(postId)} 解析成功`);
    } catch (e) {
      log(`${String(postId)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`解析成功 ${comments.length} 条评论`);
  return comments;
}

/**
 * Artalk Markdown 渲染 + 消毒（artalk/artalk2 共用；1.x setOptions 形态对齐）。
 * @param content Markdown 文本
 * @param caps 平台能力声明
 * @returns 消毒后 HTML
 */
async function renderMarkdown(content: string, caps: Capabilities): Promise<string> {
  const DOMPurify = await getDomPurify(caps);
  const marked = await getMarked();
  const html = marked.parse(content);
  return DOMPurify.sanitize(html);
}

/**
 * Artalk 导入（1.x commentImportArtalk 对齐）。
 * @param artalkDb 解析后的备份
 * @param log 日志函数
 * @param caps 平台能力声明
 * @returns 评论列表
 */
export async function commentImportArtalk(
  artalkDb: unknown,
  log: ImportLog,
  caps: Capabilities,
): Promise<CommentDoc[] | undefined> {
  if (!Array.isArray(artalkDb) || !artalkDb.length) {
    log("Artalk 评论文件格式有误");
    return undefined;
  }
  const comments: CommentDoc[] = [];
  log(`共 ${artalkDb.length} 条评论`);
  for (const c of artalkDb as Array<Record<string, unknown>>) {
    try {
      const rid = c.rid && c.rid !== "0" ? `artalk` + toStr(c.rid) : undefined;
      comments.push({
        _id: `artalk${String(c.id)}`,
        nick: c.nick as string,
        ip: c.ip as string,
        mail: c.email as string,
        mailMd5: md5(normalizeMail(c.email)),
        isSpam: false,
        ua: (c.ua as string) || "",
        link: c.link as string,
        pid: rid,
        rid,
        master: false,
        comment: await renderMarkdown(toStr(c.content), caps),
        url: getRelativeUrl(toStr(c.page_key)),
        href: c.page_key as string,
        created: new Date(c.date as string).getTime(),
        updated: Date.now(),
      });
      log(`${String(c.id)} 解析成功`);
    } catch (e) {
      log(`${String(c.id)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`解析成功 ${comments.length} 条评论`);
  return comments;
}

/**
 * Artalk v2 导入（1.x commentImportArtalk2 对齐：is_pending 判定、created_at）。
 * @param artalkDb 解析后的备份
 * @param log 日志函数
 * @param caps 平台能力声明
 * @returns 评论列表
 */
export async function commentImportArtalk2(
  artalkDb: unknown,
  log: ImportLog,
  caps: Capabilities,
): Promise<CommentDoc[] | undefined> {
  if (!Array.isArray(artalkDb) || !artalkDb.length) {
    log("Artalk v2 评论文件格式有误");
    return undefined;
  }
  const comments: CommentDoc[] = [];
  log(`共 ${artalkDb.length} 条评论`);
  for (const c of artalkDb as Array<Record<string, unknown>>) {
    try {
      const rid = c.rid && c.rid !== "0" ? `artalk` + toStr(c.rid) : undefined;
      comments.push({
        _id: `artalk${String(c.id)}`,
        nick: c.nick as string,
        ip: c.ip as string,
        mail: c.email as string,
        mailMd5: md5(normalizeMail(c.email)),
        isSpam: c.is_pending === "true",
        ua: (c.ua as string) || "",
        link: c.link as string,
        pid: rid,
        rid,
        master: false,
        comment: await renderMarkdown(toStr(c.content), caps),
        url: getRelativeUrl(toStr(c.page_key)),
        href: c.page_key as string,
        created: new Date(c.created_at as string).getTime(),
        updated: Date.now(),
      });
      log(`${String(c.id)} 解析成功`);
    } catch (e) {
      log(`${String(c.id)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`解析成功 ${comments.length} 条评论`);
  return comments;
}

/**
 * Twikoo 备份导入（1.x commentImportTwikoo 对齐）。
 * @param twikooDb 解析后的备份
 * @param log 日志函数
 * @returns 评论列表
 */
export async function commentImportTwikoo(
  twikooDb: unknown,
  log: ImportLog,
): Promise<CommentDoc[] | undefined> {
  let arr: Array<Record<string, unknown>> | undefined;
  if (Array.isArray(twikooDb)) {
    arr = twikooDb as Array<Record<string, unknown>>;
  } else if (twikooDb && typeof twikooDb === "object" && "results" in twikooDb) {
    arr = (twikooDb as { results: Array<Record<string, unknown>> }).results;
  }
  if (!arr) {
    log("Twikoo 评论文件格式有误");
    return undefined;
  }
  const comments: CommentDoc[] = [];
  log(`共 ${arr.length} 条评论`);
  for (const comment of arr) {
    try {
      comments.push(normalizeTwikooComment(comment));
      log(`${String(comment._id)} 解析成功`);
    } catch (e) {
      log(`${String(comment._id)} 解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`解析成功 ${comments.length} 条评论`);
  return comments;
}

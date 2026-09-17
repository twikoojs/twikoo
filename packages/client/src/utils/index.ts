/**
 * 客户端通用工具（1.x utils/index.js 语义对齐的 TS 重写）。
 */
import { call } from "./api";

/** 日志级别（TWIKOO_LOG_LEVEL 语义：verbose/info/warn/error） */
const logLevel: Record<string, number> = { verbose: 1, info: 2, warn: 3, error: 4 };
/** 日志级别读取（浏览器产物由 Vite define 注入；Node 测试环境走 process） */
const envLogLevel: string =
  typeof process !== "undefined" && process.env
    ? String(process.env.TWIKOO_LOG_LEVEL || "info")
    : "info";
const currentLevel = logLevel[envLogLevel.toLowerCase()] || 2;

/** 客户端日志器（console 输出，级别过滤） */
export const logger = {
  /** verbose 级 */
  verbose: (...m: unknown[]): void => {
    if (currentLevel <= 1) console.log(...m);
  },
  /** info 级 */
  info: (...m: unknown[]): void => {
    if (currentLevel <= 2) console.info(...m);
  },
  /** warn 级 */
  warn: (...m: unknown[]): void => {
    if (currentLevel <= 3) console.warn(...m);
  },
  /** error 级 */
  error: (...m: unknown[]): void => {
    if (currentLevel <= 4) console.error(...m);
  },
};

/**
 * 判断是否 URL。
 * @param s 待测字符串
 * @returns 是否 http(s):// 开头
 */
export const isUrl = (s: unknown): boolean => typeof s === "string" && /^http(s)?:\/\//.test(s);

/**
 * 判断值是否未设置（空串/undefined/null；1.x isNotSet 对齐）。
 * @param value 待测值
 * @returns 是否未设置
 */
export const isNotSet = (value: unknown): boolean =>
  value === undefined || value === null || value === "";

/** 当前语言（setLanguage 设置） */
let currentLanguage = "zh-CN";

/**
 * 设置语言（§7.2 语言优先级：options.lang → navigator.language → en）。
 * @param options 前端选项
 */
export function setLanguage(options: { lang?: string } = {}): void {
  if (options.lang) {
    currentLanguage = options.lang;
    return;
  }
  const nav = navigator.language || "en";
  // 兼容别名：zh/zh-TW 等就近归并（1.x 语义）
  if (nav.startsWith("zh")) {
    currentLanguage = "zh-CN";
  } else {
    currentLanguage = "en";
  }
}

/** 获取当前语言 */
export function getLanguage(): string {
  return currentLanguage;
}

/** 翻译占位（完整 i18n 词表随 T32 拆分落地；当前键缺省回退原文） */
export function t(key: string): string {
  return key;
}

/**
 * 相对时间（1.x timeago 对齐：分钟/小时/天/月/年）。
 * @param timestamp 毫秒时间戳
 * @param lang 语言
 * @returns 相对时间文案
 */
export function timeago(timestamp: number, lang = currentLanguage): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (lang.startsWith("zh")) {
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
  }
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

/**
 * 评论目标路径解析（1.x getUrl 对齐：TWIKOO_MAGIC_PATH 全局变量 / 表达式字符串 / 缺省）。
 * @param path 配置的 path
 * @returns 实际路径
 */
export function getUrl(path: unknown): string {
  const magic = (window as { TWIKOO_MAGIC_PATH?: string }).TWIKOO_MAGIC_PATH;
  if (magic) return magic;
  if (path && typeof path === "string") {
    switch (path) {
      case "location.pathname":
      case "window.location.pathname":
        return window.location.pathname;
      case "location.href":
      case "window.location.href":
        return window.location.href;
      default:
        return path;
    }
  }
  return window.location.pathname;
}

/**
 * 页面完整地址解析（1.x getHref 对齐）。
 * @param href 配置的 href
 * @returns 实际地址
 */
export function getHref(href: unknown): string {
  const magic = (window as { TWIKOO_MAGIC_HREF?: string }).TWIKOO_MAGIC_HREF;
  return magic ?? (typeof href === "string" ? href : window.location.href);
}

/**
 * 邮箱规范化（trim + 小写）。
 * @param mail 邮箱
 * @returns 规范化邮箱
 */
export function normalizeMail(mail: unknown): string {
  return String(mail).trim().toLowerCase();
}

/**
 * 判断是否 QQ 号/QQ 邮箱。
 * @param mail 邮箱
 * @returns 是否 QQ 形态
 */
export function isQQ(mail: string): boolean {
  return /^[1-9][0-9]{4,10}$/.test(mail) || /^[1-9][0-9]{4,10}@qq.com$/i.test(mail);
}

/**
 * 批量获取评论数 API。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 计数结果
 */
export async function getCommentsCountApi(
  tcb: unknown,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await call(tcb as never, "GET_COMMENTS_COUNT", {
    envId: options.envId,
    funcName: options.funcName,
    urls: options.urls,
    includeReply: options.includeReply,
  });
  // 1.x 语义：tcb 通道解包 { result } 信封；HTTP 通道无信封直接返回
  return result.result ?? result;
}

/**
 * 获取最新评论 API。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 最新评论
 */
export async function getRecentCommentsApi(
  tcb: unknown,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await call(tcb as never, "GET_RECENT_COMMENTS", {
    envId: options.envId,
    funcName: options.funcName,
    pageSize: options.pageSize,
    includeReply: options.includeReply,
  });
  // 1.x 语义：tcb 通道解包 { result } 信封
  return result.result ?? result;
}

/**
 * 获取访问量 API（COUNTER_GET：读取并自增）。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 计数
 */
export async function getVisitorsCountApi(
  tcb: unknown,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await call(tcb as never, "COUNTER_GET", {
    envId: options.envId,
    funcName: options.funcName,
    url: getUrl(options.path),
    href: getHref(options.href),
    title: options.title ?? document.title,
  });
  // 1.x 语义：tcb 通道解包 { result } 信封
  return result.result ?? result;
}

/**
 * 更新页面访问量（#twikoo_visitors 元素；localhost 跳过）。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 计数或 null
 */
export async function updateVisitorsCount(
  tcb: unknown,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const counterEl = document.getElementById("twikoo_visitors");
  if (!counterEl || isLocalhost()) return null;
  try {
    const counter = (await getVisitorsCountApi(tcb, options)) as { time?: number };
    if (counter.time !== undefined) {
      counterEl.innerHTML = String(counter.time);
    }
    return counter;
  } catch (e) {
    logger.warn("Failed to update visitors count", e);
    return null;
  }
}

/**
 * 外链安全化（1.x renderLinks 对齐：target=_blank + rel=noopener noreferrer nofollow ugc）。
 * @param el 容器元素或元素数组
 */
export function renderLinks(el: HTMLElement | HTMLElement[]): void {
  let aEls: HTMLCollectionOf<HTMLAnchorElement>;
  if (Array.isArray(el)) {
    const container = document.createElement("div");
    for (const item of el) {
      for (const child of Array.from(item.getElementsByTagName("a"))) {
        container.appendChild(child.cloneNode(true));
      }
    }
    aEls = container.getElementsByTagName("a");
  } else {
    aEls = el.getElementsByTagName("a");
  }
  for (const aEl of Array.from(aEls)) {
    aEl.setAttribute("target", "_blank");
    aEl.setAttribute("rel", "noopener noreferrer nofollow ugc");
  }
}

/**
 * 公式渲染（1.x renderMath 对齐：KaTeX auto-render 由使用方引入后接管）。
 * @param el 容器元素
 * @param options 渲染选项
 */
export function renderMath(el: HTMLElement, options?: unknown): void {
  const renderMathInElement = (
    window as unknown as { renderMathInElement?: (el: HTMLElement, o: unknown) => void }
  ).renderMathInElement;
  if (typeof renderMathInElement === "function") {
    renderMathInElement(
      el,
      options ?? {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\(", right: "\)", display: false },
          { left: "\[", right: "\]", display: true },
        ],
        throwOnError: false,
      },
    );
  }
}

/** 本地主机名集合 */
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** 是否本地环境（访问量计数跳过） */
export function isLocalhost(): boolean {
  return LOCALHOST_HOSTNAMES.has(window.location.hostname);
}

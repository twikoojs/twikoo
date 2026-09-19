/**
 * 客户端通用工具统一出口（1.x `utils/index.js` 语义对齐的 TS 重写）。
 *
 * 结构说明：1.x 把 i18n / marked / prism / avatar / emotion / timeago 全部塞进
 * `utils/index.js` 一个文件；2.0 按职责拆分为独立模块，本文件保留
 * 「统一出口」角色，使组件沿用 1.x 的 `from '../../utils'` 导入风格即可拿到全部能力。
 *
 * 依赖方向：本文件只做「转出 + 少量纯函数」，不反向依赖 view 层（1.x 的
 * `utils/highlight.js`、`utils/api.js` 都 import 了 view 层的 app 实例，
 * 2.0 改为经 `utils/api.ts` 的 appState 单例解耦）。
 */
import { call, getAppState, type TcbInstance } from "./api";
import { logger } from "./logger";
import { t } from "../i18n";

export { logger } from "./logger";
export { t, setLanguage, getLanguage, loadLanguage, setLocaleBaseUrl } from "../i18n";
export { sanitizeHtml } from "./sanitize";
export { renderCode } from "./highlight";
export { getQQAvatar, resolveAvatarUrl } from "./avatar";
export type { AvatarSource, AvatarConfig } from "./avatar";
export { initOwoEmotions, initMarkedOwo } from "./emotion";
export type { OwoData, OwoItem, OwoPackage } from "./emotion";
export { vLoading, vClickoutside } from "./directives";
export { parseMarkdown, setOwoImages } from "./marked";
export { call } from "./api";
export type { TcbInstance } from "./api";

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
 * 当前时间戳。
 * @param date 日期（缺省为当前时间）
 * @returns 毫秒时间戳
 */
export function timestamp(date: Date = new Date()): number {
  return date.getTime();
}

/**
 * 补全链接协议（1.x convertLink 对齐：无协议时补 `http://`）。
 * @param link 原始链接
 * @returns 补全后的链接
 */
export function convertLink(link?: string): string {
  if (!link) return "";
  if (link.substring(0, 4) !== "http") return `http://${link}`;
  return link;
}

/**
 * 相对时间（1.x timeago 对齐：秒/分/时/天/8 天以上显示日期）。
 *
 * 与 1.x 的差异：无有效日期时返回空串（1.x 返回 undefined，模板会渲染成
 * 字符串 "undefined"）。
 * @param date 时间戳或 Date
 * @returns 相对时间文案
 */
export function timeago(date?: number | Date): string {
  const value = typeof date === "number" ? new Date(date) : date;
  if (!value) return "";
  try {
    const diffValue = Date.now() - value.getTime();
    const days = Math.floor(diffValue / 86400000);
    if (days === 0) {
      const leave1 = diffValue % 86400000;
      const hours = Math.floor(leave1 / 3600000);
      if (hours === 0) {
        const leave2 = leave1 % 3600000;
        const minutes = Math.floor(leave2 / 60000);
        if (minutes === 0) {
          return `${Math.round((leave2 % 60000) / 1000)} ${t("TIMEAGO_SECONDS")}`;
        }
        return `${minutes} ${t("TIMEAGO_MINUTES")}`;
      }
      return `${hours} ${t("TIMEAGO_HOURS")}`;
    }
    if (days < 0) return t("TIMEAGO_NOW");
    if (days < 8) return `${days} ${t("TIMEAGO_DAYS")}`;
    return dateFormat(value);
  } catch (error) {
    logger.warn("timeago 计算失败", error);
    return "";
  }
}

/**
 * 日期格式化（`YYYY-MM-DD`，1.x dateFormat 对齐）。
 * @param date 日期
 * @returns 日期字符串
 */
export function dateFormat(date: Date): string {
  return [
    padWithZeros(date.getFullYear(), 2),
    padWithZeros(date.getMonth() + 1, 2),
    padWithZeros(date.getDate(), 2),
  ].join("-");
}

/**
 * 左补零。
 * @param vNumber 数字
 * @param width 目标宽度
 * @returns 补零后的字符串
 */
function padWithZeros(vNumber: number, width: number): string {
  let numAsString = vNumber.toString();
  while (numAsString.length < width) numAsString = `0${numAsString}`;
  return numAsString;
}

/** 云函数版本缓存（1.x getFuncVer 对齐：进程内只请求一次） */
let twikooFuncVer: unknown;

/**
 * 获取云函数版本（结果缓存）。
 * @param tcb 云开发实例
 * @returns GET_FUNC_VERSION 的响应
 */
export async function getFuncVer(tcb: TcbInstance | null): Promise<unknown> {
  if (twikooFuncVer === undefined) twikooFuncVer = await call(tcb, "GET_FUNC_VERSION");
  return twikooFuncVer;
}

/**
 * 解包响应信封（tcb 通道为 `{ result }`，HTTP 通道为裸响应体）。
 * @param result 原始响应
 * @returns 载荷
 */
function unwrap(result: unknown): Record<string, unknown> {
  const envelope = result as { result?: Record<string, unknown> } | null;
  if (
    envelope &&
    typeof envelope === "object" &&
    envelope.result &&
    typeof envelope.result === "object"
  ) {
    return envelope.result;
  }
  return (result ?? {}) as Record<string, unknown>;
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

/** 本地主机名集合 */
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/**
 * 是否本地环境（访问量计数跳过；1.x 语义）。
 * @returns 是否本地
 */
export function isLocalhost(): boolean {
  return LOCALHOST_HOSTNAMES.has(window.location.hostname);
}

/**
 * 批量获取评论数 API。
 * @param tcb 云开发实例
 * @param options 选项（urls 必填）
 * @returns 各 url 的计数数组
 */
export async function getCommentsCountApi(
  tcb: TcbInstance | null,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const urls = options.urls;
  if (!Array.isArray(urls)) throw new Error("urls 参数有误");
  if (urls.length === 0) return [];
  const result = await call(tcb, "GET_COMMENTS_COUNT", {
    envId: options.envId,
    funcName: options.funcName,
    urls,
    includeReply: options.includeReply,
  });
  return unwrap(result).data;
}

/**
 * 获取最新评论 API（1.x 语义：附带相对时间字段 `relativeTime`）。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 最新评论数组
 */
export async function getRecentCommentsApi(
  tcb: TcbInstance | null,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await call(tcb, "GET_RECENT_COMMENTS", {
    envId: options.envId,
    funcName: options.funcName,
    pageSize: options.pageSize,
    includeReply: options.includeReply,
  });
  const data = unwrap(result).data;
  if (Array.isArray(data)) {
    for (const comment of data as Array<{ created?: number; relativeTime?: string }>) {
      comment.relativeTime = timeago(comment.created);
    }
  }
  return data;
}

/**
 * 获取访问量 API（COUNTER_GET：读取并自增）。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 计数
 */
export async function getVisitorsCountApi(
  tcb: TcbInstance | null,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await call(tcb, "COUNTER_GET", {
    envId: options.envId,
    funcName: options.funcName,
    url: getUrl(options.path),
    href: getHref(options.href),
    title: options.title ?? document.title,
  });
  return unwrap(result);
}

/**
 * 更新页面访问量（#twikoo_visitors 元素；localhost 跳过）。
 * @param tcb 云开发实例
 * @param options 选项
 * @returns 计数或 null
 */
export async function updateVisitorsCount(
  tcb: TcbInstance | null,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const counterEl = document.getElementById("twikoo_visitors");
  if (!counterEl || isLocalhost()) return null;
  try {
    const counter = (await getVisitorsCountApi(tcb, options)) as { time?: number };
    if (counter.time !== undefined) counterEl.innerHTML = String(counter.time);
    return counter;
  } catch (e) {
    logger.warn("Failed to update visitors count", e);
    return null;
  }
}

/**
 * 读取文本文件内容（1.x readAsText 对齐）。
 * @param file 文件
 * @returns 文本内容
 */
export function readAsText(file: File): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onloadend = () => {
      if (reader.error) reject(reader.error);
      else resolve(reader.result);
    };
  });
}

/**
 * Blob 转 DataURL（1.x blobToDataURL 对齐；图床上传用）。
 * @param blob 二进制数据
 * @returns DataURL
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result;
      resolve(typeof result === "string" ? result : "");
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * 读取客户端 UA，并修正 Windows 11 / macOS 11+ 的版本号（1.x getUserAgent 对齐）。
 * @returns UA 字符串
 */
export async function getUserAgent(): Promise<string> {
  let ua = window.navigator.userAgent;
  try {
    const uaData = (
      navigator as Navigator & {
        userAgentData?: {
          platform?: string;
          getHighEntropyValues(hints: string[]): Promise<{ platformVersion?: string }>;
        };
      }
    ).userAgentData;
    if (uaData?.platform === "Windows" || uaData?.platform === "macOS") {
      const { platformVersion } = await uaData.getHighEntropyValues(["platformVersion"]);
      const major = parseInt(String(platformVersion).split(".")[0], 10);
      if (uaData.platform === "Windows" && major >= 13) {
        ua = ua.replace(/Windows NT 10\.0/i, "Windows NT 11.0");
      } else if (uaData.platform === "macOS" && major >= 11) {
        ua = ua.replace(
          /Mac OS X 10_[0-9]+_[0-9]+/i,
          `Mac OS X ${String(platformVersion).replace(/\./g, "_")}`,
        );
      }
    }
  } catch {
    // User-Agent Client Hints 不可用：保持原始 UA（1.x 行为）
  }
  return ua;
}

/**
 * 外链安全化（1.x renderLinks 对齐：target=_blank + rel=noopener noreferrer nofollow ugc）。
 *
 * 1.x 支持传入「元素」或「元素数组」；2.0 的功能性修正：数组分支直接操作原元素
 * （2.0 早期实现克隆节点后改克隆体，实际未生效）。
 * @param el 容器元素或元素数组（可为 null，用于 `$refs` 未就绪时的安全调用）
 */
export function renderLinks(el: HTMLElement | HTMLElement[] | null): void {
  if (!el) return;
  const hosts: HTMLElement[] = Array.isArray(el) ? el : [el];
  const aEls: HTMLAnchorElement[] = [];
  for (const host of hosts) {
    if (!host) continue;
    aEls.push(...Array.from(host.getElementsByTagName("a")));
  }
  for (const aEl of aEls) {
    aEl.setAttribute("target", "_blank");
    aEl.setAttribute("rel", "noopener noreferrer nofollow ugc");
  }
}

/**
 * 公式渲染（1.x renderMath 对齐：KaTeX auto-render 由使用方引入后接管）。
 * @param el 容器元素（可为 null）
 * @param options 渲染选项（缺省为四语法默认配置）
 */
export function renderMath(el: HTMLElement | null, options?: unknown): void {
  if (!el) return;
  const renderMathInElement = (
    window as unknown as { renderMathInElement?: (el: HTMLElement, o: unknown) => void }
  ).renderMathInElement;
  if (typeof renderMathInElement !== "function") return;
  renderMathInElement(
    el,
    options ?? {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
    },
  );
}

/**
 * 读取当前前端选项（组件内获取 `twikoo.init` 入参的便捷入口）。
 * @returns 前端选项
 */
export function getOptions(): Record<string, unknown> {
  return getAppState().options;
}

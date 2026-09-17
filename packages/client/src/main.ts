/**
 * twikoo 客户端公共 API（§5.5：init / getCommentsCount / getRecentComments /
 * getVisitorsCount / version 五个公开接口不变；BC-9：version 读 @twikoojs/shared，
 * 硬编码 `version.js` 删除）。
 *
 * 双入口形态（§5.2，与 1.x `main.js` / `main.all.js` 对应）：
 * - 本文件（对应 `twikoo.min.js` / `twikoo.nocss.js`）：**不含**云开发 SDK，
 *   要求使用方先自行引入 cloudbase 全局脚本（1.7.24 行为不变）；
 * - `main.all.ts`（对应 `twikoo.all.min.js` / `twikoo.all.nocss.js`）：内置云开发 SDK，
 *   经 {@link setCloudbaseProvider} 覆盖 SDK 来源。
 * 这样「是否内置 SDK」由**入口文件**决定，代码里不出现 `if (isAll)` 分支（§5.2 要求）。
 */
import { VERSION } from "@twikoojs/shared";
import { install, type TcbInstance } from "./utils/tcb";
import { render } from "./view";
import {
  logger,
  setLanguage,
  isUrl,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  updateVisitorsCount,
} from "./utils";

/** init 选项（§11.1 前端配置项集合的入口形态） */
export interface TwikooOptions {
  /** 后端地址（HTTP 形态）或云开发 envId */
  envId?: string;
  /** 云函数名（缺省 twikoo） */
  funcName?: string;
  /** 挂载点选择器（缺省 #twikoo） */
  el?: string;
  /** 页面路径（缺省 location.pathname） */
  path?: string;
  /** 页面完整地址 */
  href?: string;
  /** 语言（缺省自动检测） */
  lang?: string;
  /** 其他前端配置项（管理面板透传） */
  [key: string]: unknown;
}

/** 云开发 SDK 提供者（默认读全局 `cloudbase`；`main.all` 入口覆盖为内置 SDK） */
let cloudbaseProvider: () => unknown = () => (globalThis as { cloudbase?: unknown }).cloudbase;

/**
 * 覆盖云开发 SDK 来源（仅供 `main.all.ts` 入口调用）。
 * @param provider SDK 提供者
 */
export function setCloudbaseProvider(provider: () => unknown): void {
  cloudbaseProvider = provider;
}

/**
 * 初始化云开发实例（HTTP 地址形态跳过；缺少 SDK 时按 1.x 语义告警并返回 null）。
 * @param options 前端选项
 * @returns 云开发实例或 null
 */
async function initTcbIfNeeded(options: TwikooOptions): Promise<TcbInstance> {
  if (isUrl(options.envId)) return null;
  const cloudbase = cloudbaseProvider();
  if (typeof cloudbase === "undefined") {
    logger.error(
      'Please import cloudbase firstly:\n<script src="https://imgcache.qq.com/qcloud/cloudbase-js-sdk/1.3.3/cloudbase.full.js"></script>',
    );
    return null;
  }
  return await install(cloudbase, options);
}

/**
 * 初始化评论区（公开 API）。
 * @param options 前端选项
 */
export async function init(options: TwikooOptions = {}): Promise<void> {
  const tcb = await initTcbIfNeeded(options);
  setLanguage(options);
  render(tcb, options);
  await updateVisitorsCount(tcb, options);
}

/**
 * 批量获取文章评论数（公开 API）。
 * @param options 选项（urls 必填）
 * @returns 各 url 的计数数组
 */
export async function getCommentsCount(options: TwikooOptions = {}): Promise<unknown> {
  const tcb = await initTcbIfNeeded(options);
  return await getCommentsCountApi(tcb, options);
}

/**
 * 获取最新评论（公开 API）。
 * @param options 选项
 * @returns 最新评论数组（含 `relativeTime`）
 */
export async function getRecentComments(options: TwikooOptions = {}): Promise<unknown> {
  const tcb = await initTcbIfNeeded(options);
  return await getRecentCommentsApi(tcb, options);
}

/**
 * 获取文章访问量（公开 API）。
 * @param options 选项
 * @returns 访问量计数
 */
export async function getVisitorsCount(options: TwikooOptions = {}): Promise<unknown> {
  const tcb = await initTcbIfNeeded(options);
  return await getVisitorsCountApi(tcb, options);
}

/** 当前版本（BC-9：来自 @twikoojs/shared 占位符，发布时注入） */
export { VERSION as version };

export default init;

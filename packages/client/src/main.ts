/**
 * twikoo 客户端公共 API（规范 §5.5：init / getCommentsCount / getRecentComments /
 * getVisitorsCount / version 五个公开接口不变；BC-9：version 读 @twikoojs/shared，
 * 硬编码 version.js 删除）。
 */
import { VERSION } from "@twikoojs/shared";
import { initTcb, type TcbInstance } from "./utils/tcb";
import { render } from "./view";
import {
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

/**
 * 初始化云开发实例（HTTP 地址形态跳过）。
 * @param options 前端选项
 */
async function initTcbIfNeeded(options: TwikooOptions): Promise<TcbInstance | null> {
  return isUrl(options.envId) ? null : await initTcb(options);
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
 */
export async function getCommentsCount(options: TwikooOptions = {}): Promise<unknown> {
  const tcb = await initTcbIfNeeded(options);
  return await getCommentsCountApi(tcb, options);
}

/**
 * 获取最新评论（公开 API）。
 * @param options 选项
 */
export async function getRecentComments(options: TwikooOptions = {}): Promise<unknown> {
  const tcb = await initTcbIfNeeded(options);
  return await getRecentCommentsApi(tcb, options);
}

/**
 * 获取文章访问量（公开 API）。
 * @param options 选项
 */
export async function getVisitorsCount(options: TwikooOptions = {}): Promise<unknown> {
  const tcb = await initTcbIfNeeded(options);
  return await getVisitorsCountApi(tcb, options);
}

/** 当前版本（BC-9：来自 @twikoojs/shared 占位符，发布时注入） */
export { VERSION as version };

export default init;

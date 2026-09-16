import type { Capabilities } from "../ports/capabilities";

/**
 * 库加载器（规范 §6.5 选择性加载第三方库 + §6.5.1 D-2 依赖外部化）。
 *
 * 三层机制（加载顺序即优先级）：
 * 1. **setCustomLibs 覆写**（最高优先，1.x lib.js 逃生舱范式——eo-makers 注入
 *    直通 DOMPurify 与精简 nodemailer 的既有用法，2.0 原样兼容）；
 * 2. **能力门**：未声明对应 capability 时抛 {@link CapabilityError}
 *    （用户友好错误，绝不触发模块解析——受控平台如 EO Makers 由此走降级）；
 * 3. **动态 import**：运行时 `await import(specifier)`（specifier 经变量间接，
 *    保证零静态依赖；eslint no-restricted-imports 清单强制该纪律），
 *    解析失败抛 {@link LibLoadError}（含包名与安装提示，QA− 要求）。
 *
 * 依赖安装契约（§6.5.1）：本包以 peerDependenciesMeta(optional) 声明接口约束，
 * 重依赖由声明对应能力的适配器自行安装（CI 依赖完整性检查见 T25）。
 */

/** 库模块的最小结构类型面（仅声明 handlers 实际使用的成员） */

/** nodemailer 使用面 */
export interface NodemailerLike {
  /**
   * 创建邮件传输器
   * @param options 传输器配置（SMTP 等）
   * @returns 传输器
   */
  createTransport(options: unknown): {
    /**
     * 发送邮件
     * @param mail 邮件载荷
     * @returns 发送结果
     */
    sendMail(mail: unknown): Promise<unknown>;
  };
}

/** DOMPurify 使用面（XSS 消毒） */
export interface DOMPurifyLike {
  /**
   * 消毒 HTML
   * @param dirty 原始 HTML
   * @param config 消毒配置（FORBID_TAGS 等）
   * @returns 消毒后 HTML
   */
  sanitize(dirty: string, config?: unknown): string;
}

/** jsdom 使用面 */
export interface JSDOMLike {
  /**
   * @param html HTML 文本
   * @returns window 环境句柄
   */
  new (html: string): { window: unknown };
}

/** akismet AkismetClient 使用面 */
export interface AkismetClientLike {
  /**
   * @param config 客户端配置（key/blog）
   * @returns 客户端实例
   */
  new (config: unknown): {
    /**
     * 垃圾检测
     * @param comment 评论载荷
     * @returns 是否垃圾
     */
    checkSpam(comment: unknown): Promise<boolean>;
  };
}

/** form-data 使用面（图片上传） */
export interface FormDataLike {
  /**
   * @returns FormData 实例
   */
  new (): {
    /**
     * 附加字段/文件
     * @param name 字段名
     * @param value 值
     * @param options 附加选项
     */
    append(name: string, value: unknown, options?: unknown): void;
  };
}

/** axios 使用面 */
export interface AxiosLike {
  /**
   * POST 请求
   * @param url 地址
   * @param data 载荷
   * @param config 请求配置
   * @returns 响应
   */
  post(url: string, data?: unknown, config?: unknown): Promise<{ data: unknown }>;
  /**
   * GET 请求
   * @param url 地址
   * @param config 请求配置
   * @returns 响应
   */
  get(url: string, config?: unknown): Promise<{ data: unknown }>;
  /**
   * PUT 请求（S3 图床上传）
   * @param url 地址
   * @param data 载荷
   * @param config 请求配置
   * @returns 响应
   */
  put(url: string, data?: unknown, config?: unknown): Promise<{ data: unknown }>;
}

/** xml2js 使用面（导入 Disqus/Valine 等 XML 格式） */
export interface Xml2jsLike {
  /**
   * 解析 XML 文本
   * @param xml XML 文本
   * @returns 解析结果
   */
  parseStringPromise(xml: string): Promise<unknown>;
}

/** html-to-text 编译产物使用面（评论通知转纯文本） */
export interface HtmlToTextLike {
  /**
   * HTML 转纯文本
   * @param html HTML 文本
   * @returns 纯文本
   */
  (html: string): string;
}

/** bowser 使用面（UA 解析） */
export interface BowserLike {
  /**
   * @param ua User-Agent 字符串
   * @returns 解析器实例
   */
  getParser(ua: string): unknown;
}

/** marked 使用面（导入 Artalk 等 Markdown 内容） */
export interface MarkedLike {
  /**
   * @param options marked 配置
   */
  setOptions(options: unknown): void;
  /**
   * Markdown 转换
   * @param markdown Markdown 文本
   * @returns HTML
   */
  parse(markdown: string): string;
}

/** IP 属地库使用面（@imaegoo/node-ip2region） */
export interface Ip2RegionLike {
  /**
   * @returns 查询器实例
   */
  new (): {
    /**
     * 查询 IP 属地
     * @param ip IP 地址
     * @returns 属地信息（省份/城市）
     */
    search(ip: string): unknown;
  };
}

/** 腾讯云文本安全 SDK 使用面 */
export interface TencentcloudTmsLike {
  /** SDK 导出成员（客户端构造器等，按需解构） */
  [key: string]: unknown;
}

/** 覆写库集合（1.x setCustomLibs 的 libs 形态） */
export interface CustomLibs {
  /** 直通/自定义 DOMPurify（eo-makers 注入形态） */
  DOMPurify?: DOMPurifyLike;
  /** 自定义 nodemailer（eo-makers 精简邮件形态） */
  nodemailer?: NodemailerLike;
  /** 其余覆写项按包名索键 */
  [key: string]: unknown;
}

/** 动态导入函数类型（测试注入失败替身用） */
export type LibImporter = (specifier: string) => Promise<unknown>;

/** 默认动态导入：变量间接保证构建器不把 specifier 静态解析 */
const defaultImporter: LibImporter = async (specifier) => import(/* @vite-ignore */ specifier);

/** 当前生效的导入函数（测试可替换） */
let importer: LibImporter = defaultImporter;

/**
 * 注入库导入函数（测试缝：mock 动态 import 成功/失败）。
 * @param custom 替换的导入函数
 */
export function setLibImporter(custom: LibImporter): void {
  importer = custom;
}

/** 当前覆写库集合（模块级单例，1.x customLibs 语义） */
let customLibs: CustomLibs = {};

/**
 * 设置覆写库（逃生舱，最高优先级；1.x setCustomLibs 签名对齐）。
 * @param libs 覆写库集合
 */
export function setCustomLibs(libs: CustomLibs): void {
  customLibs = libs;
}

/**
 * 清空覆写库（测试复位）。
 */
export function resetCustomLibs(): void {
  customLibs = {};
}

/**
 * 能力未声明错误（用户友好——绝不以 MODULE_NOT_FOUND 形态暴露）。
 */
export class CapabilityError extends Error {
  /**
   * @param capability 未声明的能力名
   * @param packageName 关联包名
   * @param reason 平台补充说明（如 EO Makers 邮件受限文案）
   */
  constructor(capability: string, packageName: string, reason?: string) {
    super(
      `当前部署环境未声明 ${capability} 能力，无法加载 ${packageName}` +
        (reason ? `：${reason}` : ""),
    );
    this.name = "CapabilityError";
  }
}

/**
 * 库加载失败错误（QA−：消息含包名与安装提示）。
 */
export class LibLoadError extends Error {
  /**
   * @param packageName 加载失败的包名
   * @param cause 原始错误
   */
  constructor(packageName: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(
      `缺少依赖 ${packageName}，请在当前适配器中安装：npm install ${packageName}（原始错误：${message}）`,
    );
    this.name = "LibLoadError";
  }
}

/**
 * 能力门：未声明能力即抛 {@link CapabilityError}（加载前校验，§6.5 第二层）。
 * @param caps 平台能力声明
 * @param capability 所需能力名
 * @param packageName 关联包名
 * @param reason 平台补充说明
 */
function requireCapability(
  caps: object,
  capability: string,
  packageName: string,
  reason?: string,
): void {
  const flags = caps as Record<string, unknown>;
  if (flags[capability] !== true) {
    throw new CapabilityError(capability, packageName, reason);
  }
}

/**
 * 加载库（动态 import + 失败转 {@link LibLoadError}）。
 * @param specifier 包名
 * @returns 模块命名空间
 */
async function loadLib(specifier: string): Promise<unknown> {
  try {
    return await importer(specifier);
  } catch (e) {
    throw new LibLoadError(specifier, e);
  }
}

/**
 * 取 CJS/ESM 兼容的模块本体（ESM 命名空间的 default 优先）。
 * @param mod 模块命名空间
 * @returns 模块本体
 */
function pickDefault(mod: unknown): unknown {
  const space = mod as { default?: unknown };
  return space?.default ?? mod;
}

/**
 * 适配器能力声明入口：恒等函数，为适配器提供完整类型推断与缺键检查
 * （适配器代码形如 `capabilities: defineCapabilities({ mail: true, ... })`）。
 * @param caps 平台能力声明（八项全量）
 * @returns 原样返回的能力声明
 */
export function defineCapabilities(caps: import("../ports/capabilities").Capabilities) {
  return caps;
}

/**
 * 获取 nodemailer（mail 能力；覆写优先）。
 * @param caps 平台能力声明
 * @returns nodemailer 模块本体
 */
export async function getNodemailer(caps: Capabilities): Promise<NodemailerLike> {
  if (customLibs.nodemailer) return customLibs.nodemailer;
  requireCapability(caps, "mail", "nodemailer", "无法发送邮件");
  return pickDefault(await loadLib("nodemailer")) as NodemailerLike;
}

/**
 * 获取 DOMPurify（domPurify 能力；jsdom + dompurify 组合装载；覆写优先——
 * eo-makers 以直通 DOMPurify 注入，绕过 jsdom 依赖）。
 * @param caps 平台能力声明
 * @returns DOMPurify 实例
 */
export async function getDomPurify(caps: Capabilities): Promise<DOMPurifyLike> {
  if (customLibs.DOMPurify) return customLibs.DOMPurify;
  requireCapability(caps, "domPurify", "dompurify", "无法对评论内容做 XSS 消毒");
  const { JSDOM } = pickDefault(await loadLib("jsdom")) as { JSDOM: JSDOMLike };
  const createDOMPurify = pickDefault(await loadLib("dompurify")) as (
    window: unknown,
  ) => DOMPurifyLike;
  return createDOMPurify(new JSDOM("").window);
}

/**
 * 获取 IP 属地查询器（ip2region 能力，体积大故外部化）。
 * @param caps 平台能力声明
 * @returns 查询器构造器
 */
export async function getIpToRegion(caps: Capabilities): Promise<Ip2RegionLike> {
  requireCapability(caps, "ip2region", "@imaegoo/node-ip2region");
  return pickDefault(await loadLib("@imaegoo/node-ip2region")) as Ip2RegionLike;
}

/**
 * 获取 Akismet 客户端（akismet 能力）。
 * @param caps 平台能力声明
 * @returns AkismetClient 构造器
 */
export async function getAkismetClient(caps: Capabilities): Promise<AkismetClientLike> {
  requireCapability(caps, "akismet", "akismet-api");
  const mod = pickDefault(await loadLib("akismet-api")) as {
    AkismetClient: AkismetClientLike;
  };
  return mod.AkismetClient;
}

/**
 * 获取腾讯云文本安全 SDK（tencentTms 能力）。
 * @param caps 平台能力声明
 * @returns SDK 模块本体
 */
export async function getTencentcloudTms(caps: Capabilities): Promise<TencentcloudTmsLike> {
  requireCapability(caps, "tencentTms", "tencentcloud-sdk-nodejs-tms");
  return pickDefault(await loadLib("tencentcloud-sdk-nodejs-tms")) as TencentcloudTmsLike;
}

/**
 * 获取 FormData（imageUpload 能力）。
 * @param caps 平台能力声明
 * @returns FormData 构造器
 */
export async function getFormData(caps: Capabilities): Promise<FormDataLike> {
  requireCapability(caps, "imageUpload", "form-data");
  return pickDefault(await loadLib("form-data")) as FormDataLike;
}

/**
 * 获取 axios（qqAvatar/HTTP 请求；全部适配器可用）。
 * @returns axios 模块本体
 */
export async function getAxios(): Promise<AxiosLike> {
  return pickDefault(await loadLib("axios")) as AxiosLike;
}

/**
 * 获取 xml2js（导入器使用；全部适配器可用）。
 * @returns xml2js 模块本体
 */
export async function getXml2js(): Promise<Xml2jsLike> {
  return pickDefault(await loadLib("xml2js")) as Xml2jsLike;
}

/**
 * 获取 html-to-text 编译产物（通知纯文本；配置 1.x 对齐：忽略链接 href、跳过图片）。
 * @returns 编译后的转换函数
 */
export async function getHtmlToText(): Promise<HtmlToTextLike> {
  const mod = pickDefault(await loadLib("html-to-text")) as {
    compile(options: unknown): HtmlToTextLike;
  };
  return mod.compile({
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  });
}

/** pushoo 使用面（20 渠道即时通知） */
export interface PushooLike {
  /**
   * 发送即时通知
   * @param channel 渠道名
   * @param options 推送载荷（token/title/content/options）
   * @returns 推送结果
   */
  (channel: string, options: Record<string, unknown>): Promise<unknown>;
}

/** @xsai/generate-text 使用面（LLM 垃圾检测） */
export interface GenerateTextLike {
  /**
   * 生成文本
   * @param options 生成配置（apiKey/baseURL/model/messages 等）
   * @returns 生成结果
   */
  (options: unknown): Promise<{ text?: string }>;
}

/**
 * 获取 pushoo（通知能力；全部适配器可用）。
 * @returns pushoo 推送函数
 */
export async function getPushoo(): Promise<PushooLike> {
  const mod = pickDefault(await loadLib("pushoo")) as PushooLike;
  return mod;
}

/**
 * 获取 @xsai/generate-text（ai 能力）。
 * @param caps 平台能力声明
 * @returns generateText 函数
 */
export async function getGenerateText(caps: Capabilities): Promise<GenerateTextLike> {
  requireCapability(caps, "ai", "@xsai/generate-text");
  return (await loadLib("@xsai/generate-text")) as GenerateTextLike;
}

/**
 * 获取 bowser（UA 解析；全部适配器可用）。
 * @returns bowser 模块本体
 */
export async function getBowser(): Promise<BowserLike> {
  return pickDefault(await loadLib("bowser")) as BowserLike;
}

/**
 * 获取 marked（导入器 Markdown 解析；全部适配器可用）。
 * @returns marked 模块本体
 */
export async function getMarked(): Promise<MarkedLike> {
  return pickDefault(await loadLib("marked")) as MarkedLike;
}

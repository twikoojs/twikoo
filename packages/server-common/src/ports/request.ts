/**
 * 请求端口（规范 §6.3 请求 / 响应抽象）。
 *
 * 设计原则（规范原文）：内部只用**一种**请求表示，适配器负责「翻译」。
 * 各云平台入参（CloudBase event / Vercel req / Netlify event / AWS event /
 * EO Makers req）统一归一化为 {@link TkRequest}，翻译实现由适配器以
 * {@link RequestPort.toTkRequest} 提供。
 */
import type { TwikooEvent } from "@twikoojs/shared";

/**
 * 内部统一请求体（§6.3 承载内容：body，含 event、accessToken）。
 *
 * 已解析的 JSON 请求体：event 为 26 事件槽位之一（类型引用 @twikoojs/shared 的
 * TwikooEvent），accessToken 为匿名/管理员鉴权令牌；其余事件参数由各事件 handler
 * 自行解构，契约层不做收窄（索引签名兜底）。
 */
export interface TkRequestBody {
  /** 事件名（@twikoojs/shared 事件常量的字面量联合，27 标识符含 1.x 兼容分支） */
  event: TwikooEvent;
  /** 客户端回传的鉴权令牌；请求未携带且本次成功时，响应体会回填新令牌（1.x 语义） */
  accessToken?: string;
  /** 其余事件参数（各事件 handler 自行解构） */
  [key: string]: unknown;
}

/**
 * 内部统一请求（§6.3 字段表：method、path、query、body、headers、ip、raw）。
 *
 * 由适配器从平台原始载荷归一化而来，是 pipeline 与全部 handlers 的唯一请求形态。
 */
export interface TkRequest {
  /** HTTP 方法（大写，如 POST / OPTIONS） */
  method: string;
  /** 请求路径（如 /api/comment；CloudBase 场景可为空串） */
  path: string;
  /** 查询参数（键值对） */
  query: Record<string, string>;
  /** 解析后的请求体（见 {@link TkRequestBody}）；无请求体时为空对象 */
  body: TkRequestBody;
  /** 请求头，键已规范化为全小写（1.x vercel 适配语义） */
  headers: Record<string, string>;
  /**
   * 客户端 IP。
   *
   * 语义（§6.3）：适配器按各自平台解析后填入，公共库不再感知 TWIKOO_IP_HEADERS
   * 环境变量。netlify 填 headers.x-nf-client-connection-ip、aws-lambda 填
   * headers.requestContext.http.sourceIp、deta 填 headers.cf-connecting-ip，
   * 默认走通用取 IP 逻辑（x-forwarded-for 逐跳剥离等，随 utils/ip 迁入）。
   */
  ip: string;
  /** 平台原始载荷（CloudBase event / Vercel req / ...），供适配器回查与调试日志 */
  raw: unknown;
}

/**
 * 请求转换端口（§6.3：「每个适配器实现 toTkRequest(raw)」）。
 * 适配器把自家平台的原始载荷翻译为内部统一请求。
 */
export interface RequestPort {
  /** 平台原始载荷 → 内部统一请求 */
  toTkRequest(raw: unknown): TkRequest;
}

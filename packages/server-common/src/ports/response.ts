/**
 * 响应端口（规范 §6.3 请求 / 响应抽象）。
 *
 * 内部统一 {@link TkResponse}，由适配器以 {@link ResponsePort.fromTkResponse}
 * 翻译为各平台返回体（含状态码、CORS 头、accessToken 的承载）。
 */

/**
 * 内部统一响应体（1.x 响应包络语义对齐）。
 *
 * 1.x 实况（vercel 适配器）：业务结果恒以 JSON 返回且 HTTP 状态码恒为 200；
 * 成功体 `{ code: 0, ...数据 }`；失败体 `{ code: 非0, message }`；
 * 且当 `code === 0` 且请求未携带 accessToken 时回填 `accessToken`。
 */
export interface TkResponseBody {
  /** 业务码：0 = 成功（1.x RES_CODE.SUCCESS）；非 0 = 失败（如 1403 FORBIDDEN） */
  code: number;
  /** 消息：失败时必带（错误体 code + message），成功时为可选提示语 */
  message?: string;
  /**
   * 回填的鉴权令牌（accessToken 回填，§6.3）：
   * 仅当业务成功且请求体未携带 accessToken 时由 pipeline 回填；登录等事件直接返回。
   */
  accessToken?: string;
  /** 各事件附加返回数据（评论列表、配置项、版本号等） */
  [key: string]: unknown;
}

/**
 * 内部统一响应（§6.3 字段表：status、body、headers 含 CORS）。
 */
export interface TkResponse {
  /** HTTP 状态码（1.x 行为：业务响应恒为 200，OPTIONS 预检为 204） */
  status: number;
  /** 响应体（见 {@link TkResponseBody}） */
  body: TkResponseBody;
  /**
   * 响应头。
   *
   * 语义（§6.3）：allowCors / getAllowedOrigin 逻辑上移到公共库 pipeline
   * （保留 localhost 正则放行 + config.CORS_ALLOW_ORIGIN 逗号白名单规则），
   * CORS 头值是本 headers 的一部分；适配器只负责把 headers 写进平台响应。
   * 1.x 头集：Access-Control-Allow-Credentials / Allow-Origin / Allow-Methods(POST)
   * / Allow-Headers / Access-Control-Max-Age(600)。
   */
  headers: Record<string, string>;
}

/**
 * 响应转换端口（§6.3：「适配器实现 fromTkResponse(tkRes) → 平台返回格式」）。
 * 适配器把内部统一响应翻译为自家平台的返回体。
 */
export interface ResponsePort {
  /** 内部统一响应 → 平台返回格式 */
  fromTkResponse(response: TkResponse): unknown;
}

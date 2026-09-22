/**
 * HTTP 客户端（原生 fetch；零依赖）。
 *
 * **为什么独立成文件**：`lib-loader.ts` 只管「重依赖的惰性加载 + 能力门」，而本模块
 * 不加载任何第三方库——它直接用运行时自带的 `fetch`（Node 18+ / Workers / 浏览器），
 * 因此既不需要 `LITERAL_LOADERS` 的字面量表，也不受能力门约束。两者混在一个文件里，
 * 会让「哪些包是 external 重依赖」这条纪律变得难以一眼看清。
 *
 * 形态对齐 axios（axios 已从依赖里移除）：`{ data, status }` 返回、非 2xx 抛错且错误
 * 上带 `response.status` / `response.data`，调用方的 catch 逻辑无需改动。
 */

/** HTTP 请求配置（headers 与超时） */
export interface HttpConfig {
  /** 请求头 */
  headers?: Record<string, string>;
  /** axios 兼容字段（fetch 下无意义，接受并忽略） */
  maxBodyLength?: number;
  /** 查询参数（httpGet 用；URLSearchParams 或普通对象） */
  params?: Record<string, string> | URLSearchParams;
  /** 超时毫秒数（AbortSignal.timeout） */
  timeout?: number;
}

/** HTTP 响应（data 为解析后的 JSON 或原始文本） */
export interface HttpResult<T = unknown> {
  /** 响应体（JSON 自动解析，失败保持文本） */
  data: T;
  /** HTTP 状态码 */
  status: number;
}

/**
 * 解析查询参数为 query 串（params 兼容普通对象与 URLSearchParams）。
 * @param url 请求地址
 * @param params 查询参数
 * @returns 拼好 query 的 URL
 */
function urlWithParams(url: string, params?: Record<string, string> | URLSearchParams): string {
  const entries =
    params instanceof URLSearchParams ? [...params] : Object.entries(params ?? {});
  const queryString = new URLSearchParams(
    entries.filter(([, value]) => value !== undefined),
  ).toString();
  return queryString ? `${url}${url.includes("?") ? "&" : "?"}${queryString}` : url;
}

/**
 * 请求载荷归一：FormData（form-data 包实例）转 Buffer 并补 multipart 头，
 * 其余 JSON 对象序列化、字符串原样。
 * @param data 载荷
 * @param headers 请求头（会被补写 Content-Type）
 * @returns fetch 可用的 body
 */
function toFetchBody(
  data: unknown,
  headers: Record<string, string>,
): BodyInit | Buffer | undefined {
  if (data === undefined || data === null) return undefined;
  if (Buffer.isBuffer(data)) return data;
  const withBuffer = data as { getBuffer: () => Buffer; getHeaders: () => Record<string, string> };
  if (typeof withBuffer.getBuffer === "function") {
    Object.assign(headers, withBuffer.getHeaders());
    return withBuffer.getBuffer();
  }
  if (typeof data === "string") return data;
  headers["Content-Type"] ??= "application/json";
  return JSON.stringify(data);
}

/**
 * 发起请求（httpGet/httpPost/httpPut 的公共实现）。
 *
 * 非 2xx 抛错并在错误对象上带 `response.status` / `response.data`
 * （与 axios 的错误形态一致，调用方无需改动 catch 逻辑）。
 * @param method 请求方法
 * @param url 请求地址
 * @param data 请求载荷
 * @param config 请求配置
 * @returns 响应数据与状态码
 */
async function request<T>(
  method: string,
  url: string,
  data: unknown,
  config: HttpConfig | undefined,
): Promise<HttpResult<T>> {
  const headers: Record<string, string> = { ...(config?.headers ?? {}) };
  const body = toFetchBody(data, headers);
  const timeout = Number(config?.timeout) || undefined;
  const response = await fetch(urlWithParams(url, config?.params), {
    method,
    headers,
    body: body as BodyInit | undefined,
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 非 JSON 响应保持文本形态
  }
  if (!response.ok) {
    const error = new Error(
      `Request failed with status code ${response.status}`,
    ) as Error & { response?: { status: number; data: unknown } };
    error.response = { status: response.status, data: parsed };
    throw error;
  }
  return { data: parsed as T, status: response.status };
}

/**
 * GET 请求（原生 fetch；params 自动拼 query）。
 * @param url 地址
 * @param config 请求配置
 * @returns 响应数据与状态码
 */
export function httpGet<T = unknown>(url: string, config?: HttpConfig): Promise<HttpResult<T>> {
  return request<T>("GET", url, undefined, config);
}

/**
 * POST 请求（原生 fetch；FormData 载荷自动转 Buffer 并补 multipart 头）。
 * @param url 地址
 * @param data 载荷
 * @param config 请求配置
 * @returns 响应数据与状态码
 */
export function httpPost<T = unknown>(
  url: string,
  data?: unknown,
  config?: HttpConfig,
): Promise<HttpResult<T>> {
  return request<T>("POST", url, data, config);
}

/**
 * PUT 请求（S3 图床上传用；原生 fetch）。
 * @param url 地址
 * @param data 载荷
 * @param config 请求配置
 * @returns 响应数据与状态码
 */
export function httpPut<T = unknown>(
  url: string,
  data?: unknown,
  config?: HttpConfig,
): Promise<HttpResult<T>> {
  return request<T>("PUT", url, data, config);
}

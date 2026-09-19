/**
 * twikoo-netlify 主逻辑（Netlify 独立薄适配器——不再依赖 twikoo-vercel）。
 * 业务逻辑全部在 @twikoojs/common；数据库 MONGODB_URI→Mongo。
 * 平台核对：Functions v1 handler = async (event, context) =>
 * { statusCode, headers, body(string) }；IP 头 x-nf-client-connection-ip——
 * docs.netlify.com/functions（查阅 2026-09-17）。1.x 的 TWIKOO_IP_HEADERS
 * 环境变量机制由本适配器消化（公共库不感知该变量）。
 *
 * 后置副作用（垃圾检测 + 通知）经 {@link netlifyPostSubmitDispatcher} 以
 * HTTP 递归自调用派发到独立执行单元，见 `./dispatch.ts`。
 */
import {
  FULL_CAPABILITIES,
  MongoDatabase,
  createHandler,
  scaffoldAdapters,
  type Database,
  type TkRequest,
  type TkResponse,
} from "@twikoojs/common";
import { netlifyPostSubmitDispatcher } from "./dispatch";

/** Netlify 平台能力：全能力*/
const netlifyCapabilities = FULL_CAPABILITIES;

/** Netlify Functions v1 事件的最小结构面 */
export interface NetlifyEventLike {
  httpMethod: string;
  headers: Record<string, string | string[] | undefined>;
  /** 请求体（Netlify 交付为字符串） */
  body: string | null;
  rawUrl?: string;
}

/** Netlify 返回体（v1 形态：body 必须为字符串） */
export interface NetlifyResult {
  statusCode: number;
  headers: Record<string, string>;
  /** 返回体（isBase64Encoded 缺省 false，JSON 直接字符串化） */
  body: string;
}

/**
 * Netlify 事件 → 内部统一请求（IP 优先 x-nf-client-connection-ip，1.x 对齐）。
 * @param event Netlify 事件
 * @returns 内部统一请求
 */
export function toTkRequest(event: NetlifyEventLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const forwarded = headers["x-forwarded-for"];
  const ip =
    headers["x-nf-client-connection-ip"] ??
    headers["x-real-ip"] ??
    (forwarded ? forwarded.split(",")[0].trim() : "") ??
    "";
  let body = {} as TkRequest["body"];
  try {
    const parsed = event.body ? JSON.parse(event.body) : {};
    if (parsed && typeof parsed === "object") body = parsed as TkRequest["body"];
  } catch {
    // 非法 JSON 按空体处理（1.x try/catch 对齐）
  }
  return {
    method: event.httpMethod.toUpperCase(),
    path: "/",
    query: {},
    body,
    headers,
    ip,
    raw: event,
  };
}

/** 内部统一响应 → Netlify 返回体（204 无体；业务体字符串化）。 */
export function fromTkResponse(tkRes: TkResponse): NetlifyResult {
  if (tkRes.status === 204) {
    return { statusCode: 204, headers: {}, body: "" };
  }
  return {
    statusCode: tkRes.status,
    headers: { ...tkRes.headers, "Content-Type": "application/json" },
    body: JSON.stringify(tkRes.body),
  };
}

/**
 * 创建 Netlify 请求处理器（database 可注入；缺省按 MONGODB_URI 懒建连）。
 * @param options 注入项（database：Database 实现；mongoUri：连接串覆写）
 * @returns 逐事件处理器
 */
export function createNetlifyFunc(
  options: { database?: Database; mongoUri?: string } = {},
): (event: NetlifyEventLike) => Promise<NetlifyResult> {
  let database: Database | null = options.database ?? null;
  /** 懒建连（inject 优先；init 幂等） */
  const getDatabase = async (): Promise<Database> => {
    database ??= new MongoDatabase({ uri: options.mongoUri ?? process.env.MONGODB_URI ?? "" });
    await database.init();
    return database;
  };
  return async (event) => {
    const request = toTkRequest(event);
    const handler = createHandler(
      scaffoldAdapters({
        request: {
          /** 请求恒等透传（归一化见 toTkRequest） */
          toTkRequest: () => request,
        },
        response: {
          /** TkResponse 恒等透传（序列化见 fromTkResponse） */
          fromTkResponse: (r: TkResponse) => r,
        },
        database: await getDatabase(),
        capabilities: netlifyCapabilities,
        postSubmit: netlifyPostSubmitDispatcher,
      }),
    );
    return fromTkResponse(await handler(request));
  };
}

/** 装配缓存（handler 懒加载语义） */
let handlerFn: ((event: NetlifyEventLike) => Promise<NetlifyResult>) | null = null;

/**
 * Netlify Function 入口（exports.handler 形态，v1 CJS）。
 * @param event Netlify 事件
 * @returns Netlify 返回体
 */
export async function handler(event: NetlifyEventLike): Promise<NetlifyResult> {
  handlerFn ??= createNetlifyFunc();
  return handlerFn(event);
}

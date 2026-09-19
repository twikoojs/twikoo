/**
 * twikoo-aws-lambda 主逻辑（AWS Lambda 薄适配器）。
 * 业务逻辑全部在 @twikoojs/common；数据库 MONGODB_URI→Mongo。
 * 平台核对：API Gateway 代理集成 payload——REST API（v1：
 * httpMethod 顶层 + requestContext.identity.sourceIp）与 HTTP API（v2：
 * requestContext.http.method/sourceIp + isBase64Encoded）双形态均处理；
 * 返回体 body 必须字符串化——docs.aws.amazon.com/lambda（查阅 2026-09-17）。
 *
 * 后置副作用（垃圾检测 + 通知）经 {@link lambdaPostSubmitDispatcher} 以
 * 原生异步 Invoke 派发到独立执行单元，见 `./dispatch.ts`。
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
import { lambdaPostSubmitDispatcher } from "./dispatch";

/** AWS Lambda 平台能力：全能力*/
const lambdaCapabilities = FULL_CAPABILITIES;

/** API Gateway 代理事件的最小结构面（v1 REST / v2 HTTP API 双形态） */
export interface ApiGatewayEventLike {
  httpMethod?: string;
  requestContext: {
    http?: { method?: string; sourceIp?: string };
    identity?: { sourceIp?: string };
  };
  headers: Record<string, string | string[] | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

/** Lambda 返回体（代理集成：body 必须字符串化） */
export interface LambdaResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * API Gateway 事件 → 内部统一请求（v1/v2 双形态；IP 取 sourceIp）。
 * @param event 代理事件
 * @returns 内部统一请求
 */
export function toTkRequest(event: ApiGatewayEventLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const forwarded = headers["x-forwarded-for"];
  const ip =
    event.requestContext?.http?.sourceIp ??
    event.requestContext?.identity?.sourceIp ??
    headers["x-real-ip"] ??
    (forwarded ? forwarded.split(",")[0].trim() : "") ??
    "";
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "POST";
  let body: TkRequest["body"] = {} as TkRequest["body"];
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf-8")
      : event.body;
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    // 非法 JSON 按空体处理（1.x try/catch 对齐）
  }
  return {
    method: String(method).toUpperCase(),
    path: "/",
    query: {},
    body,
    headers,
    ip,
    raw: event,
  };
}

/** 内部统一响应 → Lambda 返回体（204 无体；body 字符串化）。 */
export function fromTkResponse(tkRes: TkResponse): LambdaResult {
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
 * 创建 Lambda 请求处理器（database 可注入；缺省按 MONGODB_URI 懒建连）。
 * @param options 注入项
 * @returns 逐事件处理器
 */
export function createLambdaFunc(
  options: { database?: Database; mongoUri?: string } = {},
): (event: ApiGatewayEventLike) => Promise<LambdaResult> {
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
        capabilities: lambdaCapabilities,
        postSubmit: lambdaPostSubmitDispatcher,
      }),
    );
    return fromTkResponse(await handler(request));
  };
}

/** 装配缓存（handler 懒加载语义） */
let handlerFn: ((event: ApiGatewayEventLike) => Promise<LambdaResult>) | null = null;

/**
 * AWS Lambda 入口（exports.handler 形态）。
 * @param event 代理事件
 * @returns Lambda 返回体
 */
export async function handler(event: ApiGatewayEventLike): Promise<LambdaResult> {
  handlerFn ??= createLambdaFunc();
  return handlerFn(event);
}

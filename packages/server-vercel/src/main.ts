/**
 * twikoo-vercel 主逻辑（Vercel 薄适配器，规范）。
 * 业务逻辑全部在 @twikoojs/common；平台核对：vercel.com/docs/functions（查阅 2026-09-17）。
 *
 * 后置副作用（垃圾检测 + 通知）经 {@link vercelPostSubmitDispatcher} 以
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
import { vercelPostSubmitDispatcher } from "./dispatch";

/** Vercel 平台能力：全能力（能力矩阵）*/
const vercelCapabilities = FULL_CAPABILITIES;

/** Vercel 请求的最小结构面（Node IncomingMessage + Vercel 扩展） */
export interface VercelRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  url?: string;
}

/** Vercel 响应的最小结构面（Node ServerResponse） */
export interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): VercelResponseLike;
  json(body: unknown): VercelResponseLike;
  end(): VercelResponseLike;
}

/**
 * Vercel 请求 → 内部统一请求（headers 小写化；query String 化；x-real-ip/转发首跳取 IP）。
 * @param req Vercel/Node 请求
 * @returns 内部统一请求
 */
export function toTkRequest(req: VercelRequestLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query ?? {})) {
    query[key] = Array.isArray(value) ? String(value[0]) : String(value ?? "");
  }
  const forwarded = headers["x-forwarded-for"];
  const ip = headers["x-real-ip"] ?? (forwarded ? forwarded.split(",")[0].trim() : "") ?? "";
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as TkRequest["body"];
  return {
    method: String(req.method ?? "POST").toUpperCase(),
    path: String(req.url ?? "/"),
    query,
    body,
    headers,
    ip,
    raw: req,
  };
}

/** 内部统一响应 → Vercel 响应（状态码 + CORS 头 + JSON 体；204 无体）。 */
export function fromTkResponse(res: VercelResponseLike, tkRes: TkResponse): void {
  res.status(tkRes.status);
  for (const [name, value] of Object.entries(tkRes.headers)) {
    res.setHeader(name, value);
  }
  if (tkRes.status === 204) {
    res.end();
    return;
  }
  res.json(tkRes.body);
}

/**
 * 创建 Vercel 请求处理器（database 可注入；缺省按 MONGODB_URI 懒建连，1.x 缓存语义）。
 * @param options 注入项（database：Database 实现；mongoUri：连接串覆写）
 * @returns 逐请求处理器 `(req, res) => Promise<void>`
 */
export function createVercelFunc(
  options: { database?: Database; mongoUri?: string } = {},
): (req: VercelRequestLike, res: VercelResponseLike) => Promise<void> {
  let database: Database | null = options.database ?? null;
  /** 懒建连（inject 优先；init 幂等） */
  const getDatabase = async (): Promise<Database> => {
    database ??= new MongoDatabase({ uri: options.mongoUri ?? process.env.MONGODB_URI ?? "" });
    await database.init();
    return database;
  };
  return async (req, res) => {
    const request = toTkRequest(req);
    const handler = createHandler(
      scaffoldAdapters({
        request: {
          /** 事件即请求体（闭包透传，见 toTkRequest） */
          toTkRequest: () => request,
        },
        response: {
          /** TkResponse 恒等透传（平台写入见 fromTkResponse） */
          fromTkResponse: (r: TkResponse) => r,
        },
        database: await getDatabase(),
        capabilities: vercelCapabilities,
        postSubmit: vercelPostSubmitDispatcher,
      }),
    );
    fromTkResponse(res, await handler(request));
  };
}

/** 装配缓存（default handler 懒加载语义） */
let handlerFn: ((req: VercelRequestLike, res: VercelResponseLike) => Promise<void>) | null = null;

/**
 * Vercel Serverless Function 默认入口。
 * @param req Vercel/Node 请求
 * @param res Vercel/Node 响应
 */
export default async function vercelHandler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  handlerFn ??= createVercelFunc();
  await handlerFn(req, res);
}

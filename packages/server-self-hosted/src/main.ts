/**
 * tkserver 主逻辑（self-hosted 薄适配器，规范 §6.6）。
 * 业务逻辑全部在 @twikoojs/common；数据库 MONGODB_URI→Mongo，否则 Loki（TWIKOO_DATA）。
 * 平台核对（§6.8）：nodejs.org/api http/信号处理（查阅 2026-09-17）。
 */
import {
  FULL_CAPABILITIES,
  LokiDatabase,
  MongoDatabase,
  createHandler,
  resetRequestTimes,
  scaffoldAdapters,
  type Database,
  type TkRequest,
  type TkResponse,
} from "@twikoojs/common";

/** tkserver 平台能力：全能力（§6.5 能力矩阵） */
const tkserverCapabilities = FULL_CAPABILITIES;

/** Node 请求的最小结构面（IncomingMessage；body 已由 server.ts 解析挂载） */
export interface ServerRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
}

/** Node 响应的最小结构面（ServerResponse + 1.x status/json 垫片） */
export interface ServerResponseLike {
  statusCode?: number;
  writableEnded?: boolean;
  writeHead(code: number, headers: Record<string, string>): unknown;
  end(body?: string): unknown;
  status(code: number): ServerResponseLike;
  json(body: unknown): ServerResponseLike;
}

/**
 * Node 请求 → 内部统一请求（headers 小写化；x-real-ip/转发首跳取 IP）。
 * @param req Node 请求
 * @returns 内部统一请求
 */
export function toTkRequest(req: ServerRequestLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const forwarded = headers["x-forwarded-for"];
  const ip = headers["x-real-ip"] ?? (forwarded ? forwarded.split(",")[0].trim() : "") ?? "";
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as TkRequest["body"];
  return {
    method: String(req.method ?? "POST").toUpperCase(),
    path: String(req.url ?? "/"),
    query: {},
    body,
    headers,
    ip,
    raw: req,
  };
}

/** 内部统一响应 → Node 响应（204 无体；业务 JSON；垫片语义对齐 1.x）。 */
export function fromTkResponse(res: ServerResponseLike, tkRes: TkResponse): void {
  if (tkRes.status === 204) {
    res.writeHead(204, {});
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(tkRes.body));
}

/**
 * 创建 tkserver 请求处理器（database 可注入；缺省按 MONGODB_URI/TWIKOO_DATA 选择）。
 * @param options 注入项
 * @returns 逐请求处理器
 */
export function createTkserverHandler(
  options: { database?: Database; dataDir?: string; mongoUri?: string } = {},
): (req: ServerRequestLike, res: ServerResponseLike) => Promise<void> {
  let database: Database | null = options.database ?? null;
  /** 数据库选择（1.x server.js：MONGODB_URI → mongo，否则 loki） */
  const getDatabase = async (): Promise<Database> => {
    if (!database) {
      const mongoUri = options.mongoUri ?? process.env.MONGODB_URI ?? process.env.MONGO_URL ?? "";
      database = mongoUri
        ? new MongoDatabase({ uri: mongoUri })
        : new LokiDatabase({
            dataDir: options.dataDir ?? process.env.TWIKOO_DATA ?? "./data",
          });
    }
    await database.init();
    return database;
  };
  return async (req, res) => {
    const request = toTkRequest(req);
    const handler = createHandler(
      scaffoldAdapters({
        request: {
          /** 请求恒等透传（归一化见 toTkRequest） */
          toTkRequest: () => request,
        },
        response: {
          /** TkResponse 恒等透传（写入见 fromTkResponse） */
          fromTkResponse: (r: TkResponse) => r,
        },
        database: await getDatabase(),
        capabilities: tkserverCapabilities,
      }),
    );
    fromTkResponse(res, await handler(request));
  };
}

/**
 * 优雅退出（1.x shutdown 语义：停限流清理定时器 → 关数据库）。
 * @param options 清理项
 */
export async function shutdown(
  options: {
    timer?: NodeJS.Timeout | null;
    database?: Database | null;
  } = {},
): Promise<void> {
  if (options.timer) clearInterval(options.timer);
  await options.database?.close?.();
}

/** requestTimes 清理周期（1.x TWIKOO_REQ_TIMES_CLEAR_TIME，缺省 10 分钟） */
export function getRequestTimesClearInterval(): number {
  return parseInt(process.env.TWIKOO_REQ_TIMES_CLEAR_TIME ?? "", 10) || 10 * 60 * 1000;
}

/** 启动限流计数定时清理（返回定时器供 shutdown 停用） */
export function startRequestTimesTimer(): NodeJS.Timeout {
  return setInterval(() => resetRequestTimes(), getRequestTimesClearInterval());
}

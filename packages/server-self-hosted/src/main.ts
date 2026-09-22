/**
 * tkserver 主逻辑（self-hosted 薄适配器）。
 * 业务逻辑全部在 @twikoojs/common；数据库 MONGODB_URI→Mongo，否则 Loki（TWIKOO_DATA）。
 * 平台核对：nodejs.org/api http/信号处理（查阅 2026-09-17）。
 */
import {
  FULL_CAPABILITIES,
  createHandler,
  resetRequestTimes,
  scaffoldAdapters,
  type Database,
  type TkRequest,
  type TkResponse,
} from "@twikoojs/common";
import { createTkserverDatabase } from "./database";

/** tkserver 平台能力：全能力*/
const tkserverCapabilities = FULL_CAPABILITIES;

/** Node 请求的最小结构面（IncomingMessage；body 已由 server.ts 解析挂载） */
export interface ServerRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
  /** 连接套接字（1.x get-user-ip 的 connection/socket 兜底来源） */
  socket?: { remoteAddress?: string };
  /** 连接对象（Node 的 req.connection，同上） */
  connection?: { remoteAddress?: string; socket?: { remoteAddress?: string } };
}

/**
 * 默认 IP 来源顺序（1.7.24 `get-user-ip` 的 `defaultHeaders` 逐项对齐）。
 *
 * 前三个是代理头，后三个是**直连兜底**——2.0 曾只保留代理头，导致直连访客
 * 的 IP 全落到空串、共用同一个限流桶（#1174）。
 */
export const DEFAULT_IP_SOURCES = [
  "headers.x-client-ip",
  "headers.x-real-ip",
  "headers.x-forwarded-for",
  "connection.remoteAddress",
  "socket.remoteAddress",
  "connection.socket.remoteAddress",
] as const;

/** 找不到任何来源时的兜底值（1.x get-user-ip 返回 `0.0.0.0`） */
const FALLBACK_IP = "0.0.0.0";

/**
 * 解析单个 IP 来源（`headers.<name>` 与 `connection/socket.remoteAddress` 两类点路径）。
 * @param req 原始 Node 请求
 * @param headers 已小写化的请求头
 * @param source 点路径来源
 * @returns 命中的 IP；未命中返回空串
 */
function resolveIpSource(
  req: ServerRequestLike,
  headers: Record<string, string>,
  source: string,
): string {
  if (source.startsWith("headers.")) {
    const name = source.slice("headers.".length).toLowerCase();
    const value = headers[name];
    if (!value) return "";
    // x-forwarded-for 是多跳列表（客户端 IP, 代理 1, 代理 2...），取首跳
    return (name === "x-forwarded-for" ? value.split(",")[0] : value).trim();
  }
  switch (source) {
    case "connection.remoteAddress":
      return req.connection?.remoteAddress ?? "";
    case "socket.remoteAddress":
      return req.socket?.remoteAddress ?? "";
    case "connection.socket.remoteAddress":
      return req.connection?.socket?.remoteAddress ?? "";
    default:
      return "";
  }
}

/**
 * 按来源顺序解析客户端 IP（1.x getIp 语义：TWIKOO_IP_HEADERS 覆写来源顺序）。
 * @param req 原始 Node 请求
 * @param headers 已小写化的请求头
 * @returns 客户端 IP；全部未命中时返回 `0.0.0.0`
 */
function resolveClientIp(req: ServerRequestLike, headers: Record<string, string>): string {
  let sources: string[] = [...DEFAULT_IP_SOURCES];
  if (process.env.TWIKOO_IP_HEADERS) {
    try {
      const parsed = JSON.parse(process.env.TWIKOO_IP_HEADERS) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        // 1.x 语义：自定义来源**优先**，未命中时继续按默认顺序找
        sources = [...parsed, ...DEFAULT_IP_SOURCES];
      }
    } catch (e) {
      console.error("获取 IP 错误信息：", e);
    }
  }
  for (const source of sources) {
    const ip = resolveIpSource(req, headers, source);
    if (ip) return ip;
  }
  return FALLBACK_IP;
}

/**
 * Node 请求 → 内部统一请求（headers 小写化；IP 来源顺序见
 * {@link DEFAULT_IP_SOURCES}，可用 TWIKOO_IP_HEADERS 覆写）。
 * @param req Node 请求
 * @returns 内部统一请求
 */
export function toTkRequest(req: ServerRequestLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const ip = resolveClientIp(req, headers);
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
 * 内部统一响应 → Node 响应（204 无体；业务 JSON 透传 tkRes.status；
 * headers 原样回写——CORS 由 pipeline 算好，业务分支在其后补 Content-Type；
 * 垫片语义对齐 1.x）。
 */
export function fromTkResponse(res: ServerResponseLike, tkRes: TkResponse): void {
  if (tkRes.status === 204) {
    res.writeHead(204, tkRes.headers);
    res.end();
    return;
  }
  res.writeHead(tkRes.status, { ...tkRes.headers, "Content-Type": "application/json" });
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
    if (!database) database = createTkserverDatabase(options);
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
        // 后置副作用派发**刻意不传**：tkserver 是常驻进程，scaffoldAdapters 的
        // 默认实现即「进程内直调 postSubmit 服务且不 await」——1.x
        // `postSubmit(comment)` 语义（见 src/server/self-hosted/index.js）。
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

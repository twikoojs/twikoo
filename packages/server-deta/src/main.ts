/**
 * twikoo-deta 主逻辑（Deta Space 薄适配器）。
 * 业务逻辑全部在 @twikoojs/common；Deta 走 HTTP（Express 1.x 形态 → Node http）。
 * 平台核对：Deta 自身无法获取评论者 IP，需经 Cloudflare CDN 部署，
 * IP 取 cf-connecting-ip——deta.space/docs（查阅 2026-09-17）。
 */
import {
  FULL_CAPABILITIES,
  MongoDatabase,
  createHandler,
  resetRequestTimes,
  scaffoldAdapters,
  type Database,
  type TkRequest,
  type TkResponse,
} from "@twikoojs/common";
import { createServer, type Server } from "node:http";

/** Deta 平台能力：全能力（经 Cloudflare CDN 部署形态）*/
const detaCapabilities = FULL_CAPABILITIES;

/** Node 请求的最小结构面（body 已解析挂载） */
export interface DetaRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** Deta IP 提取：cf-connecting-ip 优先（Cloudflare CDN 形态）。 */
export function extractIp(headers: Record<string, string>): string {
  return headers["cf-connecting-ip"] ?? "";
}

/**
 * Node 请求 → 内部统一请求。
 * @param req Node 请求
 * @returns 内部统一请求
 */
/**
 * Node 请求 → 内部统一请求（cf-connecting-ip 取 IP）。
 * @param req Node 请求
 * @returns 内部统一请求
 */
export function toTkRequest(req: DetaRequestLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as TkRequest["body"];
  return {
    method: String(req.method ?? "POST").toUpperCase(),
    path: "/",
    query: {},
    body,
    headers,
    ip: extractIp(headers),
    raw: req,
  };
}

/** Node 响应最小结构面（status/json 垫片由 server 引导装配） */
type MinimalRes = {
  writeHead(code: number, headers: Record<string, string>): unknown;
  end(body?: string): unknown;
};

/**
 * 内部统一响应 → Deta HTTP 响应（状态码与响应头**透传**；204 无体）。
 *
 * ⚠️ 不能写死 200 并丢弃 `tkRes.headers`：pipeline 把 5 个 CORS 头算在
 * `tkRes.headers` 里，OPTIONS 预检依赖它们返回 204 + CORS 头；限流超限则
 * 依赖 `tkRes.status === 429` 让客户端映射「请求过于频繁」。丢弃后前者会让
 * 跨源评论直接不可用，后者会让 2.0 的 429 改进在该平台静默失效。
 *
 * 与 self-hosted 同为 Node http 形态，实现保持一致。
 * @param res Node 响应（最小结构面）
 * @param tkRes 内部统一响应
 */
export function fromTkResponse(res: MinimalRes, tkRes: TkResponse): void {
  if (tkRes.status === 204) {
    res.writeHead(204, tkRes.headers);
    res.end();
    return;
  }
  res.writeHead(tkRes.status, { ...tkRes.headers, "Content-Type": "application/json" });
  res.end(JSON.stringify(tkRes.body));
}

/**
 * 创建 Deta 请求处理器（database 可注入；缺省按 MONGODB_URI 懒建连）。
 * @param options 注入项
 * @returns 逐请求处理器
 */
export function createDetaHandler(
  options: { database?: Database; mongoUri?: string } = {},
): (req: DetaRequestLike, res: MinimalRes) => Promise<void> {
  let database: Database | null = options.database ?? null;
  /** 懒建连 */
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
          /** 请求恒等透传（归一化见 toTkRequest） */
          toTkRequest: () => request,
        },
        response: {
          /** TkResponse 恒等透传（写入见 fromTkResponse） */
          fromTkResponse: (r: TkResponse) => r,
        },
        database: await getDatabase(),
        capabilities: detaCapabilities,
        // 后置副作用派发**刻意不传**：deta 形态是常驻 Node 服务（本文件末尾
        // createServer + listen），scaffoldAdapters 的默认实现即「进程内直调
        // postSubmit 服务且不 await」，无需自调用。
      }),
    );
    fromTkResponse(res, await handler(request));
  };
}

/**
 * 启动 Deta HTTP 服务器（1.x app.listen(8080) 形态；限流清理定时器随启停）。
 * @param options 启动项
 * @returns 服务器与 shutdown（测试用）
 */
export function startDetaServer(options: { database?: Database; port?: number } = {}): {
  server: Server;
  shutdown: () => Promise<void>;
} {
  const handler = createDetaHandler({ database: options.database });
  /** 限流清理定时器（1.x self-hosted 同款机制） */
  const timer = setInterval(() => resetRequestTimes(), 10 * 60 * 1000);
  const server = createServer((req, res) => {
    void (async () => {
      const buffers: Buffer[] = [];
      for await (const chunk of req) buffers.push(chunk);
      try {
        (req as { body?: unknown }).body = JSON.parse(Buffer.concat(buffers).toString() || "{}");
      } catch {
        (req as { body?: unknown }).body = {};
      }
      await handler(req, res);
    })().catch(() => {
      if (!res.writableEnded) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 1000, message: "internal error" }));
      }
    });
  });
  server.listen(options.port ?? 8080);
  return {
    server,
    /** 停监听 + 停定时器 */
    shutdown: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      clearInterval(timer);
    },
  };
}

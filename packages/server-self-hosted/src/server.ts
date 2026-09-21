/**
 * tkserver bin 入口（HTTP 服务器引导；业务逻辑在 @twikoojs/common + main.ts）。
 * 1.x server.js 语义对齐：JSON body 解析、socket 跟踪、退出信号优雅关闭、
 * 关闭期间 503。TWIKOO_SKIP_BOOT=1 时仅导出工厂不启动（测试进程内装配）。
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import {
  createTkserverHandler,
  getRequestTimesClearInterval,
  shutdown,
  startRequestTimesTimer,
} from "./main";
import { createTkserverDatabase } from "./database";
import type { Database } from "@twikoojs/common";

/** 垫片后的响应形态（Node 响应 + status/json） */
type ServerResponseShim = import("./main").ServerResponseLike;

/** 垫片中的请求形态（body 已解析挂载） */
type ServerRequestShim = import("./main").ServerRequestLike & { body?: unknown };

/** 健康检查路径（两个名字都收：编排系统常用 /healthz） */
const HEALTH_PATHS = new Set(["/ping", "/healthz"]);

/**
 * 去掉 URL 的查询串（`/ping?x=1` 仍按 `/ping` 处理）。
 * @param url Node 请求 URL（可能带 query 或为空）
 * @returns 纯路径
 */
function stripQuery(url: string | undefined): string {
  return (url ?? "/").split("?")[0];
}

/** 服务器实例与生命周期控制（createTkserverServer 产物） */
export interface TkserverInstance {
  /** HTTP 服务器（未监听；listen 由调用方执行） */
  server: Server;
  /** 已装配的数据库实例（供启动期 seed 复用）*/
  database: Database;
  /** 优雅关闭（关监听 → 排空连接 → 停定时器 → 关数据库） */
  gracefulShutdown: () => Promise<void>;
  /** 注册 SIGTERM/SIGINT 处理（TWIKOO_SHUTDOWN_TIMEOUT 兜底强杀） */
  registerSignalHandlers: () => void;
}

/**
 * 创建 tkserver 服务器实例（不监听、不注册信号——由 bin 底部或测试驱动）。
 * @param options 注入项（数据库可注入，缺省按 MONGODB_URI/TWIKOO_DATA 选择）
 * @returns 服务器实例与生命周期控制
 */
export function createTkserverServer(options: { database?: Database } = {}): TkserverInstance {
  const database = options.database ?? createTkserverDatabase();
  const handler = createTkserverHandler({ database });
  const timer = startRequestTimesTimer();
  const sockets = new Set<Socket>();
  let isShuttingDown = false;

  const server = createServer((req, res) => {
    if (isShuttingDown) {
      res.writeHead(503, { Connection: "close", "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 503, message: "Twikoo server is shutting down" }));
      return;
    }
    // 健康检查短路：不进 pipeline、不碰数据库——走 pipeline 会在数据库未就绪时探活失败，反而失去意义。
    // 放在 isShuttingDown 之后：关闭开始后 server.close() 会让新连接直接被拒，只有复用
    // keep-alive 连接的探活才会走到这里拿到 503——两种结果对编排都表示不健康
    if (req.method === "GET" && HEALTH_PATHS.has(stripQuery(req.url))) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0, message: "pong" }));
      return;
    }
    void (async () => {
      /** 聚合请求体（JSON 解析失败按空体处理，1.x 语义） */
      const buffers: Buffer[] = [];
      for await (const chunk of req) buffers.push(chunk as Buffer);
      try {
        (req as ServerRequestShim).body = JSON.parse(Buffer.concat(buffers).toString() || "{}");
      } catch {
        (req as ServerRequestShim).body = {};
      }
      /** status/json 垫片（1.x server.js 对齐） */
      const shimmed = res as unknown as ServerResponseShim;
      shimmed.status = (code: number) => {
        res.statusCode = code;
        return shimmed;
      };
      shimmed.json = (json: unknown) => {
        if (!res.writableEnded) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(json));
        }
        return shimmed;
      };
      await handler(req, shimmed);
    })().catch(() => {
      if (!res.writableEnded) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 1000, message: "internal error" }));
      }
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  /** 优雅关闭（关监听 → 排空连接 → shutdown 资源） */
  const gracefulShutdown = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const socket of sockets) socket.destroy();
    await shutdown({ timer });
  };

  /** SIGTERM / SIGINT → 优雅退出（超时兜底强杀） */
  const registerSignalHandlers = (): void => {
    const timeout = parseInt(process.env.TWIKOO_SHUTDOWN_TIMEOUT ?? "", 10) || 5000;
    /** 信号回调：竞速优雅关闭与超时兜底 */
    const onSignal = (): void => {
      void Promise.race([
        gracefulShutdown(),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]).then(() => process.exit(0));
    };
    process.on("SIGTERM", onSignal);
    process.on("SIGINT", onSignal);
  };

  return { server, database, gracefulShutdown, registerSignalHandlers };
}

/**
 * 启动 tkserver（bin `dist/server.js` 与 `twikoo-pkg` 的 SEA 产物共用入口）：
 * 可选 demo seed → 监听端口 → 注册信号处理。
 * @param options 注入项（数据库可注入，缺省按 MONGODB_URI/TWIKOO_DATA 选择）
 * @returns 已进入监听的服务器实例
 */
export async function startTkserver(
  options: { database?: Database } = {},
): Promise<TkserverInstance> {
  const instance = createTkserverServer(options);
  const { server, database, registerSignalHandlers } = instance;
  const port = parseInt(process.env.TWIKOO_PORT ?? "", 10) || 8080;
  const host =
    process.env.TWIKOO_HOST ?? (process.env.TWIKOO_LOCALHOST_ONLY === "true" ? "localhost" : "::");

  if (process.env.TWIKOO_SEED === "1") {
    try {
      /** 动态 import：未开启 seed 时本模块不会被加载（生产不可触达第一道防线） */
      const { seedDemoData } = await import("./seed");
      await seedDemoData({ database });
    } catch (e) {
      /** seed 属演示辅助：失败不阻断服务启动，但必须显式报错（不静默） */
      console.error("[twikoo-seed] seed 失败，服务仍将启动：", e);
    }
  }

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => {
      const actual = (server.address() as AddressInfo).port;
      console.log(`Twikoo server started on host ${host} port ${actual}`);
      resolve();
    });
  });
  registerSignalHandlers();
  void getRequestTimesClearInterval;
  return instance;
}

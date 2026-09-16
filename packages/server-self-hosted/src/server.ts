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

/** 垫片后的响应形态（Node 响应 + status/json） */
type ServerResponseShim = import("./main").ServerResponseLike;

/** 垫片中的请求形态（body 已解析挂载） */
type ServerRequestShim = import("./main").ServerRequestLike & { body?: unknown };

/** 服务器实例与生命周期控制（createTkserverServer 产物） */
export interface TkserverInstance {
  /** HTTP 服务器（未监听；listen 由调用方执行） */
  server: Server;
  /** 优雅关闭（关监听 → 排空连接 → 停定时器 → 关数据库） */
  gracefulShutdown: () => Promise<void>;
  /** 注册 SIGTERM/SIGINT 处理（TWIKOO_SHUTDOWN_TIMEOUT 兜底强杀） */
  registerSignalHandlers: () => void;
}

/**
 * 创建 tkserver 服务器实例（不监听、不注册信号——由 bin 底部或测试驱动）。
 * @returns 服务器实例与生命周期控制
 */
export function createTkserverServer(): TkserverInstance {
  const handler = createTkserverHandler();
  const timer = startRequestTimesTimer();
  const sockets = new Set<Socket>();
  let isShuttingDown = false;

  const server = createServer((req, res) => {
    if (isShuttingDown) {
      res.writeHead(503, { Connection: "close", "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 503, message: "Twikoo server is shutting down" }));
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

  return { server, gracefulShutdown, registerSignalHandlers };
}

/** 测试进程内装配时跳过自动启动（TWIKOO_SKIP_BOOT=1） */
if (process.env.TWIKOO_SKIP_BOOT !== "1") {
  const { server, registerSignalHandlers } = createTkserverServer();
  const port = parseInt(process.env.TWIKOO_PORT ?? "", 10) || 8080;
  const host =
    process.env.TWIKOO_HOST ?? (process.env.TWIKOO_LOCALHOST_ONLY === "true" ? "localhost" : "::");

  server.listen(port, host, () => {
    const actual = (server.address() as AddressInfo).port;
    console.log(`Twikoo server started on host ${host} port ${actual}`);
  });
  registerSignalHandlers();
  void getRequestTimesClearInterval;
}

/**
 * tkserver 适配器测试。
 *
 * 启动 → 请求 → SIGTERM 优雅退出全流程（spawn dist/server.js）；
 * 数据目录不可写 → init 抛可读错误；
 * 另含 handler 契约核心事件（内存库注入）与 shutdown 资源清理单测。
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LokiDatabase } from "@twikoojs/common";
import {
  createTkserverHandler,
  fromTkResponse,
  shutdown,
  startRequestTimesTimer,
  toTkRequest,
} from "../src/main";
import type { ServerRequestLike, ServerResponseLike } from "../src/main";
import type { Database, TkResponse } from "@twikoojs/common";

/** 记录型响应（status/json 垫片后形态） */
function makeRes(): {
  res: ServerResponseLike;
  out: { status: number; headers?: Record<string, string>; body?: string };
} {
  const out: { status: number; headers?: Record<string, string>; body?: string } = { status: 0 };
  const res: ServerResponseLike = {
    statusCode: 0,
    writableEnded: false,
    /**
     *
     */
    writeHead: (code: number, headers?: Record<string, string>) => {
      out.status = code;
      out.headers = headers ?? {};
      return res;
    },
    /**
     *
     */
    end: (body?: string) => {
      out.body = body;
      res.writableEnded = true;
      return res;
    },
    /**
     *
     */
    status: (code: number) => {
      out.status = code;
      return res;
    },
    /**
     *
     */
    json: (body: unknown) => {
      out.body = JSON.stringify(body);
      res.writableEnded = true;
      return res;
    },
  };
  return { res, out };
}

describe("tkserver handler", () => {
  it("happy：GET_FUNC_VERSION → 200 JSON（Loki 临时目录自动建库）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-"));
    // 注入 Loki 实例（而不是只传 dataDir）是为了能在删临时目录前 close()：Loki 带
    // `autosaveInterval: 4000`，目录被 rmSync 掉之后那个定时器仍会写 db.json 并抛出
    // 未捕获的 ENOENT —— 用例本身是通过的，文件却被判 FAIL。
    const db = new LokiDatabase({ dataDir: join(dir, "data") });
    const handler = createTkserverHandler({ database: db });
    const req: ServerRequestLike = {
      method: "POST",
      headers: {},
      body: { event: "GET_FUNC_VERSION" },
    };
    const { res, out } = makeRes();
    await handler(req, res);
    await db.close();
    rmSync(dir, { recursive: true, force: true });
    const body = JSON.parse(out.body as string);
    expect(body.code).toBe(0);
    expect(typeof body.version).toBe("string");
  });

  it("数据目录不可创建（父级为文件）→ 明确错误非静默", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-bad-"));
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "x");
    const handler = createTkserverHandler({ dataDir: join(blocker, "data") });
    const { res } = makeRes();
    await expect(handler({ method: "POST", headers: {}, body: {} }, res)).rejects.toThrow(
      /ENOTDIR|EEXIST|not a directory/i,
    );
    expect(existsSync(join(blocker, "data", "db.json"))).toBe(false);
    chmodSync(blocker, 0o644);
    rmSync(dir, { recursive: true, force: true });
  });

  it("shutdown：停清理定时器 + 关数据库", async () => {
    let closed = false;
    let cleared = false;
    const fakeTimer = setInterval(() => {}, 10_000) as NodeJS.Timeout;
    const db = {
      /**
       *
       */
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    } as unknown as Database;
    const realClear = clearInterval;
    const timer = startRequestTimesTimer();
    vi.spyOn(globalThis, "clearInterval").mockImplementation(((t: NodeJS.Timeout) => {
      if (t === fakeTimer || t === timer) cleared = true;
      realClear(t);
    }) as never);
    await shutdown({ timer: fakeTimer, database: db });
    vi.restoreAllMocks();
    expect(cleared).toBe(true);
    expect(closed).toBe(true);
    clearInterval(timer);
  });
});

/**
 * 回归（端到端冒烟暴露）：重依赖外部化到适配器安装，
 * 而 pnpm isolated 链接下适配器的 node_modules 不在 common 自身解析路径上——
 * 若不把重依赖声明为 `@twikoojs/common` 的 optional peerDependencies，
 * `await import("jsdom")` 会在 common 内 MODULE_NOT_FOUND，COMMENT_SUBMIT 直接 1000 失败。
 * 本用例**不注入任何替身**（不 setCustomLibs），走真实 jsdom + DOMPurify 解析。
 */
describe("tkserver 真实重依赖解析（回归）", () => {
  it("COMMENT_SUBMIT：真实 jsdom+DOMPurify 加载成功且 XSS 内容被清洗", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-real-libs-"));
    // 同 happy 用例：注入实例以便收尾 close()，避免 Loki autosave 在目录删除后写盘
    const db = new LokiDatabase({ dataDir: join(dir, "data") });
    const handler = createTkserverHandler({ database: db });
    const submit = makeRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          event: "COMMENT_SUBMIT",
          nick: "回归",
          mail: "regression@example.com",
          url: "/demo.html",
          ua: "UA",
          comment: "<p>回归评论</p><script>alert(1)</script>",
        },
      },
      submit.res,
    );
    const submitted = JSON.parse(submit.out.body as string) as { code: number; id?: string };
    expect(submitted.code).toBe(0);
    expect(typeof submitted.id).toBe("string");

    const get = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { event: "COMMENT_GET", url: "/demo.html" } },
      get.res,
    );
    const listed = get.out.body as string;
    expect(listed).toContain("回归评论");
    expect(listed).not.toContain("<script");
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  }, 30000);
});

/**
 * 回归（浏览器跨源实测暴露）：pipeline 已把 5 个 CORS 头算进 tkRes.headers
 * （「适配器只负责把 headers 写进平台响应」），但 fromTkResponse 曾把 headers 整个丢弃、
 * 且状态码硬编码 200（限流 429 被吞）。vercel 适配器为正确参照。
 */
describe("fromTkResponse CORS 头回写与状态码透传（跨源回归）", () => {
  it("204 预检分支：writeHead 收到 tkRes.headers（CORS 头不被丢弃）", () => {
    const { res, out } = makeRes();
    const tkRes: TkResponse = {
      status: 204,
      body: {},
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:9820",
        "Access-Control-Allow-Methods": "POST",
      },
    };
    fromTkResponse(res, tkRes);
    expect(out.status).toBe(204);
    expect(out.headers?.["Access-Control-Allow-Origin"]).toBe("http://localhost:9820");
    expect(out.headers?.["Access-Control-Allow-Methods"]).toBe("POST");
  });

  it("JSON 业务分支：状态码透传 tkRes.status（429 不被硬编码吞掉）且 headers 带 CORS + Content-Type", () => {
    const { res, out } = makeRes();
    const tkRes: TkResponse = {
      status: 429,
      body: { code: 1000, message: "too many requests" },
      headers: { "Access-Control-Allow-Origin": "http://localhost:9820" },
    };
    fromTkResponse(res, tkRes);
    expect(out.status).toBe(429);
    expect(out.headers?.["Access-Control-Allow-Origin"]).toBe("http://localhost:9820");
    expect(out.headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(out.body as string)).toEqual({ code: 1000, message: "too many requests" });
  });
});

/**
 * 取一个当前空闲的端口。
 *
 * 不能图省事写 `TWIKOO_PORT=0`：`startTkserver` 里是
 * `parseInt(process.env.TWIKOO_PORT ?? "", 10) || 8080`，**0 是假值 → 回落到 8080**，
 * 而本地经常同时跑着 `pnpm demo`（tkserver 占 8080）→ 本用例以 EADDRINUSE 收场。
 * 先探一个空闲端口再显式传入，才是名副其实的「随机端口」。
 * @returns 空闲端口
 */
async function findFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** 全流程辅助：spawn dist/server.js（指定端口）→ HTTP 请求 → SIGTERM */
function spawnServer(
  env: NodeJS.ProcessEnv,
  port: number,
): {
  proc: ReturnType<typeof spawn>;
  ready: Promise<number>;
} {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    TWIKOO_PORT: String(port),
    TWIKOO_DATA: join(mkdtempSync(join(tmpdir(), "tkserver-e2e-")), "data"),
    ...env,
  };
  // 本文件前三个用例为「进程内装配」把 TWIKOO_SKIP_BOOT=1 写进了 process.env，而这里会把
  // process.env 整个传给子进程 —— 带着它 `dist/server.js` 走 factory-export-only 模式
  // **静默退出**（src/bin.ts 的 `if (process.env.TWIKOO_SKIP_BOOT !== "1")`），
  // 永远打印不出 "port N"，用例只能等到超时。故显式剔除（同类坑：工厂模块的
  // 「不启动」开关会被父进程环境继承）。
  delete childEnv.TWIKOO_SKIP_BOOT;
  const proc = spawn(process.execPath, [join(__dirname, "../dist/server.js")], { env: childEnv });
  const ready = new Promise<number>((resolve, reject) => {
    // 定时器要在落定后清掉：否则 15s 的挂起定时器会一直吊着测试进程（拖长整轮时间）
    const timer = setTimeout(() => reject(new Error("server start timeout")), 15000);
    proc.stdout?.on("data", (chunk: Buffer) => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      clearTimeout(timer);
      reject(new Error(chunk.toString()));
    });
  });
  return { proc, ready };
}

describe("tkserver 优雅退出全流程", () => {
  it("启动 → HTTP 请求成功 → 优雅关闭 → 端口关闭（进程内流程，全平台）", async () => {
    process.env.TWIKOO_SKIP_BOOT = "1";
    const { createTkserverServer } = await import("../src/server");
    const inst = createTkserverServer();
    await new Promise<void>((resolve) => inst.server.listen(0, "127.0.0.1", resolve));
    const port = (inst.server.address() as import("node:net").AddressInfo).port;
    // 服务中请求成功
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
    });
    const body = (await response.json()) as { code: number };
    expect(body.code).toBe(0);
    // 优雅关闭：请求 → 关监听 → 排空连接 → 停定时器
    await inst.gracefulShutdown();
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  }, 20000);

  it("OPTIONS 预检：204 且携带 Access-Control-Allow-Origin（真实 HTTP 跨源回归）", async () => {
    process.env.TWIKOO_SKIP_BOOT = "1";
    const { createTkserverServer } = await import("../src/server");
    const inst = createTkserverServer();
    await new Promise<void>((resolve) => inst.server.listen(0, "127.0.0.1", resolve));
    const port = (inst.server.address() as import("node:net").AddressInfo).port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:9820",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).not.toBeNull();
    } finally {
      await inst.gracefulShutdown();
    }
  }, 20000);

  it("请求体超限：413 且不进入 pipeline；正常请求不受影响（GHSA-v349-m8q5-7x2g）", async () => {
    process.env.TWIKOO_SKIP_BOOT = "1";
    // 把上限压到 1 KB，避免测试真的传 16 MB
    process.env.TWIKOO_MAX_BODY_BYTES = "1024";
    const { createTkserverServer } = await import("../src/server");
    const inst = createTkserverServer();
    await new Promise<void>((resolve) => inst.server.listen(0, "127.0.0.1", resolve));
    const port = (inst.server.address() as import("node:net").AddressInfo).port;
    const url = `http://127.0.0.1:${port}/`;
    try {
      // 形态一：Content-Length 已超限 → 快速拒绝（一个字节都不读）
      const declared = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "GET_FUNC_VERSION", pad: "x".repeat(4096) }),
      });
      expect(declared.status).toBe(413);

      // 形态二：分块传输（无 Content-Length）→ 靠「边读边累加」兜底
      const stream = new ReadableStream<Uint8Array>({
        /**
         * 推入超限数据后结束。
         * @param controller 流控制器
         */
        start(controller) {
          controller.enqueue(new TextEncoder().encode("x".repeat(4096)));
          controller.close();
        },
      });
      const chunked = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: stream,
        // Node 的 fetch 要求流式请求体显式声明 half duplex
        duplex: "half",
      } as RequestInit & { duplex: "half" });
      expect(chunked.status).toBe(413);

      // 未超限的请求照常走 pipeline
      const ok = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
      });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { code: number }).code).toBe(0);
    } finally {
      delete process.env.TWIKOO_MAX_BODY_BYTES;
      await inst.gracefulShutdown();
    }
  }, 20000);

  it("gracefulShutdown：关闭数据库（shutdown 接收已装配的 database，#1174 回归）", async () => {
    process.env.TWIKOO_SKIP_BOOT = "1";
    const { createTkserverServer } = await import("../src/server");
    let closed = false;
    const db = {
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    } as unknown as Database;
    const inst = createTkserverServer({ database: db });
    await inst.gracefulShutdown();
    expect(closed).toBe(true);
  });

  it("SIGTERM 信号处理：已注册（全平台）", async () => {
    process.env.TWIKOO_SKIP_BOOT = "1";
    const { createTkserverServer } = await import("../src/server");
    const before = process.listeners("SIGTERM").length;
    const inst = createTkserverServer();
    inst.registerSignalHandlers();
    expect(process.listeners("SIGTERM").length).toBe(before + 1);
    await inst.gracefulShutdown();
  });

  it.runIf(process.platform !== "win32")(
    "spawn 全流程：SIGTERM → 进程 0 退出（Windows SIGTERM 为硬杀，跳过）",
    async () => {
      const { proc, ready } = spawnServer({}, await findFreePort());
      const port = await ready;
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "GET_FUNC_VERSION" }),
      });
      const body = (await response.json()) as { code: number };
      expect(body.code).toBe(0);
      const exited = new Promise<number | null>((resolve) =>
        proc.on("exit", (code) => resolve(code)),
      );
      proc.kill("SIGTERM");
      expect(await exited).toBe(0);
    },
    20000,
  );

  it("健康检查：GET /ping 直接 200 + pong，且不进 pipeline（数据库不可用也不受影响）", async () => {
    process.env.TWIKOO_SKIP_BOOT = "1";
    const { createTkserverServer } = await import("../src/server");
    /** 任何方法都抛错的数据库替身：走 pipeline 的请求必然失败，/ping 短路则不受影响
     * （close 豁免：gracefulShutdown 需要经 shutdown 正常关库） */
    const failingDb = new Proxy({} as Database, {
      get: (_target, prop) =>
        prop === "close"
          ? () => Promise.resolve()
          : async () => {
              throw new Error(`db.${String(prop)} 被调用`);
            },
    });
    const inst = createTkserverServer({ database: failingDb });
    await new Promise<void>((resolve) => inst.server.listen(0, "127.0.0.1", resolve));
    const port = (inst.server.address() as AddressInfo).port;
    try {
      const ping = await fetch(`http://127.0.0.1:${port}/ping`);
      expect(ping.status).toBe(200);
      const body = (await ping.json()) as { code: number; message: string };
      expect(body.code).toBe(0);
      expect(body.message).toBe("pong");
      // 编排系统常用的 /healthz 同名支持
      const healthz = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(healthz.status).toBe(200);
    } finally {
      await inst.gracefulShutdown();
    }
  }, 20000);
});

describe("客户端 IP 解析（#1174：恢复 get-user-ip 的直连兜底）", () => {
  /**
   * 构造最小 Node 请求。
   * @param overrides 覆盖字段
   * @returns 请求对象
   */
  function makeReq(overrides: Partial<ServerRequestLike> = {}): ServerRequestLike {
    return { method: "POST", headers: {}, body: {}, ...overrides };
  }

  it("代理头优先：x-client-ip > x-real-ip > x-forwarded-for（多跳取首跳）", () => {
    expect(toTkRequest(makeReq({ headers: { "x-client-ip": "10.0.0.1" } })).ip).toBe("10.0.0.1");
    expect(toTkRequest(makeReq({ headers: { "x-real-ip": "10.0.0.2" } })).ip).toBe("10.0.0.2");
    expect(
      toTkRequest(makeReq({ headers: { "x-forwarded-for": "10.0.0.3, 172.16.0.1" } })).ip,
    ).toBe("10.0.0.3");
    // x-client-ip 压过 x-real-ip / x-forwarded-for
    expect(
      toTkRequest(
        makeReq({
          headers: {
            "x-client-ip": "10.0.0.1",
            "x-real-ip": "10.0.0.2",
            "x-forwarded-for": "10.0.0.3",
          },
        }),
      ).ip,
    ).toBe("10.0.0.1");
  });

  it("无代理头时用 connection/socket.remoteAddress 兜底（直连不再全落空 IP）", () => {
    // 直连：只有 socket
    expect(toTkRequest(makeReq({ socket: { remoteAddress: "203.0.113.7" } })).ip).toBe(
      "203.0.113.7",
    );
    // connection.remoteAddress 优先于 socket
    expect(
      toTkRequest(
        makeReq({
          connection: { remoteAddress: "203.0.113.8" },
          socket: { remoteAddress: "203.0.113.7" },
        }),
      ).ip,
    ).toBe("203.0.113.8");
    // connection.socket.remoteAddress 兜底
    expect(
      toTkRequest(makeReq({ connection: { socket: { remoteAddress: "203.0.113.9" } } })).ip,
    ).toBe("203.0.113.9");
  });

  it("全部来源缺失 → 0.0.0.0（1.x get-user-ip 兜底值）", () => {
    expect(toTkRequest(makeReq()).ip).toBe("0.0.0.0");
  });

  it("TWIKOO_IP_HEADERS 覆写来源（如 CloudFlare 的 cf-connecting-ip）", () => {
    process.env.TWIKOO_IP_HEADERS = JSON.stringify(["headers.cf-connecting-ip"]);
    try {
      const req = makeReq({
        headers: { "cf-connecting-ip": "198.51.100.5", "x-real-ip": "10.0.0.2" },
        socket: { remoteAddress: "203.0.113.7" },
      });
      expect(toTkRequest(req).ip).toBe("198.51.100.5");
    } finally {
      delete process.env.TWIKOO_IP_HEADERS;
    }
  });

  it("TWIKOO_IP_HEADERS 非法 JSON → 回退默认来源顺序（不抛错）", () => {
    process.env.TWIKOO_IP_HEADERS = "{ not json";
    try {
      expect(toTkRequest(makeReq({ headers: { "x-real-ip": "10.0.0.2" } })).ip).toBe("10.0.0.2");
    } finally {
      delete process.env.TWIKOO_IP_HEADERS;
    }
  });
});

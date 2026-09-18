/**
 * tkserver 适配器测试（T22）。
 *
 * QA+：启动 → 请求 → SIGTERM 优雅退出全流程（spawn dist/server.js）；
 * QA−：数据目录不可写 → init 抛可读错误；
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

describe("tkserver handler（T22）", () => {
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

  it("QA−：数据目录不可创建（父级为文件）→ 明确错误非静默", async () => {
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
 * 回归（T35 端到端冒烟暴露）：D-2 把重依赖外部化到适配器安装，
 * 而 pnpm isolated 链接下适配器的 node_modules 不在 common 自身解析路径上——
 * 若不把重依赖声明为 `@twikoojs/common` 的 optional peerDependencies，
 * `await import("jsdom")` 会在 common 内 MODULE_NOT_FOUND，COMMENT_SUBMIT 直接 1000 失败。
 * 本用例**不注入任何替身**（不 setCustomLibs），走真实 jsdom + DOMPurify 解析。
 */
describe("tkserver 真实重依赖解析（D-2 / §6.5.1 回归）", () => {
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
 * 回归（浏览器跨源实测暴露）：pipeline 已把 5 个 CORS 头算进 tkRes.headers（§6.3
 * 「适配器只负责把 headers 写进平台响应」），但 fromTkResponse 曾把 headers 整个丢弃、
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

/** QA+ 全流程辅助：spawn dist/server.js（指定端口）→ HTTP 请求 → SIGTERM */
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
  // 永远打印不出 "port N"，用例只能等到超时。故显式剔除（§17.2 同类坑：工厂模块的
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

describe("tkserver 优雅退出全流程（T22 QA+）", () => {
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
});

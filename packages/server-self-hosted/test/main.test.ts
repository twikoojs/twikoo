/**
 * tkserver 适配器测试（T22）。
 *
 * QA+：启动 → 请求 → SIGTERM 优雅退出全流程（spawn dist/server.js）；
 * QA−：数据目录不可写 → init 抛可读错误；
 * 另含 handler 契约核心事件（内存库注入）与 shutdown 资源清理单测。
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTkserverHandler, shutdown, startRequestTimesTimer } from "../src/main";
import type { ServerRequestLike, ServerResponseLike } from "../src/main";
import type { Database } from "@twikoojs/common";

/** 记录型响应（status/json 垫片后形态） */
function makeRes(): { res: ServerResponseLike; out: { status: number; body?: string } } {
  const out: { status: number; body?: string } = { status: 0 };
  const res: ServerResponseLike = {
    statusCode: 0,
    writableEnded: false,
    /**
     *
     */
    writeHead: (code: number) => {
      out.status = code;
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
    const handler = createTkserverHandler({ dataDir: join(dir, "data") });
    const req: ServerRequestLike = {
      method: "POST",
      headers: {},
      body: { event: "GET_FUNC_VERSION" },
    };
    const { res, out } = makeRes();
    await handler(req, res);
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

  it("行数门禁：main.ts（适配器核心）< 150 行（bin server.ts 与 seed/ 豁免）", () => {
    /**
     *
     */
    const lines = (path: string): number =>
      readFileSync(new URL(path, import.meta.url), "utf8").split("\n").length;
    expect(lines("../src/main.ts")).toBeLessThan(150);
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
    const handler = createTkserverHandler({ dataDir: join(dir, "data") });
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
    rmSync(dir, { recursive: true, force: true });
  }, 30000);
});

/** QA+ 全流程辅助：spawn dist/server.js（随机端口）→ HTTP 请求 → SIGTERM */
function spawnServer(env: NodeJS.ProcessEnv): {
  proc: ReturnType<typeof spawn>;
  ready: Promise<number>;
} {
  const proc = spawn(process.execPath, [join(__dirname, "../dist/server.js")], {
    env: {
      ...process.env,
      TWIKOO_PORT: "0",
      TWIKOO_DATA: join(mkdtempSync(join(tmpdir(), "tkserver-e2e-")), "data"),
      ...env,
    },
  });
  const ready = new Promise<number>((resolve, reject) => {
    proc.stdout?.on("data", (chunk: Buffer) => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) resolve(Number(match[1]));
    });
    proc.stderr?.on("data", (chunk: Buffer) => reject(new Error(chunk.toString())));
    setTimeout(() => reject(new Error("server start timeout")), 15000);
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
      const { proc, ready } = spawnServer({});
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

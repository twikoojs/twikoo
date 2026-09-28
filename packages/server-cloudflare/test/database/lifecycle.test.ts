/** MongoDB 的逐请求所有权与 POST_SUBMIT 收尾回归，不依赖外部 MongoDB 服务。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MongoDatabase,
  getPostSubmitService,
  resetCustomLibs,
  resetRequestTimes,
  setPostSubmitService,
} from "@twikoojs/common";
import type { ConfigData } from "@twikoojs/common";
import { createCloudflareFunc, getD1Database } from "../../src/main";
import type { ExecutionContextLike } from "../../src/main";
import { createSqliteD1 } from "../utils/sqlite-d1";

/** 创建可手动释放的异步关卡，避免依赖延时判断执行顺序。 */
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** 生成可经过实际 pipeline 的请求。 */
function request(submit = false): Request {
  return new Request("https://twikoo.example.com/", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.8" },
    body: JSON.stringify(
      submit
        ? { event: "COMMENT_SUBMIT", url: "/lifecycle", ua: "test", comment: "hello" }
        : { event: "GET_FUNC_VERSION" },
    ),
  });
}

/** 本地驱动替身只隔离网络；实际装配、pipeline 和派发器均照常运行。 */
describe("MongoDB 请求生命周期", () => {
  const opened: MongoDatabase[] = [];
  const closed = new Set<MongoDatabase>();
  const previousService = getPostSubmitService();
  const env = { MONGODB_URI: "mongodb://localhost/twikoo" };

  beforeEach(() => {
    opened.length = 0;
    closed.clear();
    resetCustomLibs();
    resetRequestTimes();
    vi.spyOn(MongoDatabase.prototype, "init").mockImplementation(async function (
      this: MongoDatabase,
    ) {
      opened.push(this);
    });
    vi.spyOn(MongoDatabase.prototype, "close").mockImplementation(async function (
      this: MongoDatabase,
    ) {
      closed.add(this);
    });
    vi.spyOn(MongoDatabase.prototype, "getConfig").mockImplementation(async function (
      this: MongoDatabase,
    ) {
      if (closed.has(this)) throw new Error("database closed prematurely");
      return { LIMIT_PER_MINUTE: "0", LIMIT_PER_MINUTE_ALL: "0" };
    });
    vi.spyOn(MongoDatabase.prototype, "addComment").mockImplementation(async function (
      this: MongoDatabase,
      comment,
    ) {
      if (closed.has(this)) throw new Error("database closed prematurely");
      return { ...comment, _id: "saved-comment" };
    });
  });

  afterEach(() => {
    setPostSubmitService(previousService);
    resetCustomLibs();
    vi.restoreAllMocks();
  });

  it("同一 URI 的并发请求互不共享连接，先完成的请求不关闭另一条连接", async () => {
    const started = [gate(), gate()];
    const finish = [gate(), gate()];
    vi.mocked(MongoDatabase.prototype.getConfig).mockImplementation(async function (
      this: MongoDatabase,
    ) {
      const index = opened.indexOf(this);
      started[index].release();
      await finish[index].promise;
      if (closed.has(this)) throw new Error("database closed prematurely");
      return {};
    });
    const handler = createCloudflareFunc();
    const first = handler(request(), env);
    await started[0].promise;
    const second = handler(request(), env);
    await started[1].promise;
    try {
      expect(opened[0]).not.toBe(opened[1]);
      finish[1].release();
      expect(await (await second).json()).toMatchObject({ code: 0 });
      expect(closed.has(opened[1])).toBe(true);
      expect(closed.has(opened[0])).toBe(false);
      finish[0].release();
      expect(await (await first).json()).toMatchObject({ code: 0 });
      expect(closed.has(opened[0])).toBe(true);
      expect(MongoDatabase.prototype.close).toHaveBeenCalledTimes(2);
    } finally {
      finish.forEach((item) => item.release());
      await Promise.all([first, second]);
    }
  });

  it.each(["init", "addComment"] as const)("%s 失败仍关闭连接并保留业务失败体", async (method) => {
    vi.mocked(MongoDatabase.prototype[method]).mockRejectedValueOnce(new Error("database failure"));
    const response = await createCloudflareFunc()(request(method === "addComment"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: 1000, message: "database failure" });
    expect(MongoDatabase.prototype.close).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("后台任务结束后才关闭连接（失败：%s），响应无需等待", async (fail) => {
    const finish = gate();
    const pending: Promise<unknown>[] = [];
    const executionCtx: ExecutionContextLike = {
      /** 收集 Workers 托管的完整后台任务。 */
      waitUntil(promise) {
        pending.push(promise);
      },
    };
    let readAfterResponse: ConfigData | null = null;
    setPostSubmitService(async (_comment, ctx) => {
      await finish.promise;
      readAfterResponse = await ctx.adapters.database.getConfig();
      if (fail) throw new Error("background failure");
      return { code: 0 };
    });
    try {
      const response = await createCloudflareFunc()(request(true), env, executionCtx);
      expect(await response.json()).toMatchObject({ code: 0, id: "saved-comment" });
      expect(MongoDatabase.prototype.close).not.toHaveBeenCalled();
      expect(readAfterResponse).toBeNull();
      finish.release();
      await Promise.all(pending);
      expect(readAfterResponse).toMatchObject({ LIMIT_PER_MINUTE: "0" });
      expect(MongoDatabase.prototype.close).toHaveBeenCalledTimes(1);
    } finally {
      finish.release();
      await Promise.all(pending);
    }
  });

  it("后台任务同步抛错仍返回已保存评论并关闭连接", async () => {
    setPostSubmitService(() => {
      throw new Error("synchronous background failure");
    });
    const response = await createCloudflareFunc()(request(true), env);
    expect(await response.json()).toMatchObject({ code: 0, id: "saved-comment" });
    expect(MongoDatabase.prototype.close).toHaveBeenCalledTimes(1);
  });

  it("离线调用等待后置任务完成，不会提前关闭 MongoDB", async () => {
    const started = gate();
    const finish = gate();
    let readAfterRelease: ConfigData | null = null;
    setPostSubmitService(async (_comment, ctx) => {
      started.release();
      await finish.promise;
      readAfterRelease = await ctx.adapters.database.getConfig();
      return { code: 0 };
    });
    let responded = false;
    const response = createCloudflareFunc()(request(true), env).then((value) => {
      responded = true;
      return value;
    });
    try {
      await started.promise;
      expect(responded).toBe(false);
      expect(MongoDatabase.prototype.close).not.toHaveBeenCalled();
      finish.release();
      expect(await (await response).json()).toMatchObject({ code: 0 });
      expect(readAfterRelease).toMatchObject({ LIMIT_PER_MINUTE: "0" });
      expect(MongoDatabase.prototype.close).toHaveBeenCalledTimes(1);
    } finally {
      finish.release();
      await response;
    }
  });

  it("连接关闭失败不覆盖成功响应", async () => {
    vi.mocked(MongoDatabase.prototype.close).mockRejectedValueOnce(new Error("close failure"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await createCloudflareFunc()(request(), env);
    expect(await response.json()).toMatchObject({ code: 0 });
    expect(error).toHaveBeenCalledWith("MongoDB 连接关闭失败", expect.any(Error));
  });

  it("注入的 MongoDB 不受 MONGODB_URI 覆盖，连接仍由调用方拥有", async () => {
    const database = new MongoDatabase({ uri: "mongodb://localhost/injected" });
    const response = await createCloudflareFunc({ database })(request(), env);
    expect(await response.json()).toMatchObject({ code: 0 });
    expect(opened).toEqual([database]);
    expect(MongoDatabase.prototype.close).not.toHaveBeenCalled();
  });

  it("未配置 URI 时复用 D1，MongoDB 配置不影响注入库的所有权", async () => {
    const binding = createSqliteD1();
    const close = vi.fn();
    const database = Object.assign(getD1Database({ DB: binding }), { close });
    try {
      const handler = createCloudflareFunc();
      expect(await (await handler(request(), { DB: binding })).json()).toMatchObject({ code: 0 });
      await database.saveConfig({ BLOG_NAME: "persistent" });
      expect(await (await handler(request(), { DB: binding })).json()).toMatchObject({ code: 0 });
      expect(await database.getConfig()).toMatchObject({ BLOG_NAME: "persistent" });
      expect(await (await createCloudflareFunc({ database })(request(), env)).json()).toMatchObject(
        { code: 0 },
      );
      expect(MongoDatabase.prototype.init).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    } finally {
      binding.close();
    }
  });
});

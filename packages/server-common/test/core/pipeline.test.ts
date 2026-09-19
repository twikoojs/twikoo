/**
 * pipeline 八步编排测试（验收）。
 *
 * 覆盖验收断言：
 * 1. GET_FUNC_VERSION 走通（含 accessToken 回填语义）；
 * 2. OPTIONS → 204（且 CORS 头已产出）；
 * 3. 超限流 → 429；
 * 4. COMMENT_SUBMIT 只**派发**副作用，POST_SUBMIT（带内部令牌）才执行副作用链，
 *    两条路径命中同一 postSubmit 服务；
 * 5. 事件清单完整性（25 标识符）与 COMMENT_GET_FOR_ADMIN 的 type 筛选
 *    （见 dispatcher.test.ts）。
 * 另覆盖未知事件统一错误体、CORS 白名单 / 校验失败 / handler 异常路径。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMENT_SUBMIT, type TwikooEvent } from "@twikoojs/shared";
import {
  createHandler,
  registerHandler,
  resetHandlers,
  resetRequestTimes,
  setPostSubmitService,
  RECURSION_HEADER,
  getRecursionToken,
  RES_CODE,
} from "../../src/index";
import type { CommentDoc, TkAdapters } from "../../src/index";
import { registerDefaultHandlers } from "../../src/handlers";
import { getPostSubmitService } from "../../src/services/post-submit";
import { RecordingDispatcher, createMemoryAdapters, makeRequest } from "../utils/memory-adapters";

afterEach(() => {
  // 复位注册表 / 限流计数 / 环境变量 stub，避免用例间污染
  resetHandlers();
  registerDefaultHandlers();
  resetRequestTimes();
  vi.unstubAllEnvs();
});

describe("pipeline 八步编排", () => {
  it("验收 1：GET_FUNC_VERSION 走通并回填 accessToken", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(makeRequest({ body: { event: "GET_FUNC_VERSION" } }));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RES_CODE.SUCCESS);
    // version 来自 @twikoojs/shared 占位符（构建期注入真实值），运行时恒为字符串
    expect(typeof res.body.version).toBe("string");
    // 请求未携带 accessToken 且业务成功 → 回填新令牌（1.x 语义）
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken).toMatch(/^[0-9a-f]{32}$/);
  });

  it("请求已携带 accessToken 时成功响应不回填", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(
      makeRequest({ body: { event: "GET_FUNC_VERSION", accessToken: "existing" } }),
    );
    expect(res.body.code).toBe(RES_CODE.SUCCESS);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("验收 2：OPTIONS 预检返回 204 且携带 CORS 头", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(
      makeRequest({
        method: "OPTIONS",
        headers: { origin: "https://example.com" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
    expect(res.headers["Access-Control-Allow-Methods"]).toBe("POST");
    expect(res.headers["Access-Control-Max-Age"]).toBe("600");
  });

  it("验收 3：超过 TWIKOO_THROTTLE 上限返回 429", async () => {
    vi.stubEnv("TWIKOO_THROTTLE", "2");
    const handler = createHandler(createMemoryAdapters());
    const ip = "203.0.113.9";
    await handler(makeRequest({ ip }));
    await handler(makeRequest({ ip }));
    const third = await handler(makeRequest({ ip }));
    expect(third.status).toBe(429);
    expect(third.body.code).toBe(RES_CODE.FAIL);
    expect(third.body.message).toBe("Too Many Requests");
  });

  it("验收 4：COMMENT_SUBMIT 只派发，POST_SUBMIT（带令牌）才执行副作用链——同一 postSubmit 服务", async () => {
    // 记录 postSubmit 服务的全部调用（副作用证据）
    const calls: CommentDoc[] = [];
    setPostSubmitService(async (comment) => {
      calls.push(comment);
      return { code: RES_CODE.SUCCESS };
    });
    const dispatcher = new RecordingDispatcher();
    const config = { ADMIN_PASS: "stored-hash" };
    const handler = createHandler(
      createMemoryAdapters({ database: config, postSubmit: dispatcher }),
    );
    // 注册 COMMENT_SUBMIT 替身：遵循契约——保存成功后**派发**，不内联等待
    registerHandler(COMMENT_SUBMIT, async (ctx) => {
      const comment = (ctx.request.body.comment ?? {}) as CommentDoc;
      await ctx.adapters.postSubmit.dispatch({ ...comment, _id: "c1" }, ctx);
      return { code: RES_CODE.SUCCESS, id: "c1" };
    });
    await handler(makeRequest({ body: { event: COMMENT_SUBMIT, comment: { nick: "提交者" } } }));
    // 派发端口被调用，且派发触达同一 postSubmit 服务
    expect(dispatcher.dispatched.map((c) => c.nick)).toEqual(["提交者"]);
    expect(calls.map((c) => c.nick)).toEqual(["提交者"]);

    // POST_SUBMIT：无内部派发令牌 → 1403 拒绝（防外部滥用）
    const forbidden = await handler(
      makeRequest({ body: { event: "POST_SUBMIT", comment: { nick: "外部调用" } } }),
    );
    expect(forbidden.body.code).toBe(RES_CODE.FORBIDDEN);
    expect(calls.map((c) => c.nick)).toEqual(["提交者"]);

    // POST_SUBMIT：带令牌 → 执行副作用链，与 COMMENT_SUBMIT 路径同一服务
    await handler(
      makeRequest({
        body: { event: "POST_SUBMIT", comment: { nick: "直接调用" } },
        headers: { [RECURSION_HEADER]: getRecursionToken(config) },
      }),
    );
    expect(calls.map((c) => c.nick)).toEqual(["提交者", "直接调用"]);
  });

  it("回归：COMMENT_SUBMIT 不等待副作用链（云函数超时 / 用户等待防护）", async () => {
    const previous = getPostSubmitService();
    /** 副作用闸门：未放行前副作用链一直挂起，模拟耗时的垃圾检测 + 通知 */
    let releaseEffects: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseEffects = resolve;
    });
    const effects: string[] = [];
    setPostSubmitService(async () => {
      await gate;
      effects.push("done");
      return { code: RES_CODE.SUCCESS };
    });
    try {
      const dispatcher = new RecordingDispatcher();
      dispatcher.awaitEffects = false;
      const adapters = createMemoryAdapters({
        database: { ADMIN_PASS: "h" },
        postSubmit: dispatcher,
      });
      registerHandler(COMMENT_SUBMIT, async (ctx) => {
        const comment = (ctx.request.body.comment ?? {}) as CommentDoc;
        await ctx.adapters.postSubmit.dispatch({ ...comment, _id: "c1" }, ctx);
        return { code: RES_CODE.SUCCESS, id: "c1" };
      });
      // 副作用仍挂起，提交响应必须已经返回（否则云函数会超时）
      const res = await createHandler(adapters)(
        makeRequest({ body: { event: COMMENT_SUBMIT, comment: { nick: "提交者" } } }),
      );
      expect(res.body.code).toBe(RES_CODE.SUCCESS);
      expect(effects).toEqual([]);
      // 放行后副作用完成（证明它确实在后台继续跑，而不是被丢弃）
      releaseEffects();
      await vi.waitFor(() => expect(effects).toEqual(["done"]));
    } finally {
      setPostSubmitService(previous);
    }
  });

  it("未知事件名返回统一错误体（不抛未捕获异常）", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(
      makeRequest({ body: { event: "NOT_A_REAL_EVENT" as unknown as TwikooEvent } }),
    );
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RES_CODE.EVENT_NOT_EXIST);
    expect(res.body.message).toContain("请更新 Twikoo 云函数至最新版本");
  });

  it("缺少 event 参数返回 NO_PARAM 运行正常提示（1.x 健康检查语义）", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(makeRequest({ body: {} }));
    expect(res.body.code).toBe(RES_CODE.NO_PARAM);
    expect(res.body.message).toContain("Twikoo 云函数运行正常");
    expect(typeof res.body.version).toBe("string");
  });

  it("CORS：localhost 放行、白名单精确匹配（条目去尾斜杠）、不在名单禁止", async () => {
    const handler = createHandler(
      createMemoryAdapters({ database: { CORS_ALLOW_ORIGIN: "https://a.com,https://b.com/" } }),
    );
    // localhost 正则恒放行
    const localhost = await handler(
      makeRequest({
        body: { event: "GET_FUNC_VERSION" },
        headers: { origin: "http://localhost:9820" },
      }),
    );
    expect(localhost.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:9820");
    // 白名单条目 https://b.com/（去尾斜杠）匹配请求 origin https://b.com
    const whitelisted = await handler(
      makeRequest({ body: { event: "GET_FUNC_VERSION" }, headers: { origin: "https://b.com" } }),
    );
    expect(whitelisted.headers["Access-Control-Allow-Origin"]).toBe("https://b.com");
    // 不在名单 → 空 Origin（禁止跨域）
    const denied = await handler(
      makeRequest({ body: { event: "GET_FUNC_VERSION" }, headers: { origin: "https://evil.com" } }),
    );
    expect(denied.headers["Access-Control-Allow-Origin"]).toBe("");
  });

  it("无 Origin 头时不产出 CORS 头（1.x 条件对齐）", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(makeRequest({ body: { event: "GET_FUNC_VERSION" } }));
    expect(Object.keys(res.headers)).toHaveLength(0);
  });

  it("客户端字段类型校验：对象字段被拒绝（防操作符注入）", async () => {
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(makeRequest({ body: { event: "COMMENT_GET", url: { $ne: null } } }));
    expect(res.body.code).toBe(RES_CODE.FAIL);
    expect(res.body.message).toBe('参数"url"必须是字符串');
  });

  it("handler 抛错转统一错误体并附带聚合日志（HTTP 仍 200，1.x 语义）", async () => {
    registerHandler("COUNTER_GET" as TwikooEvent, () => {
      throw new Error("boom");
    });
    const handler = createHandler(createMemoryAdapters());
    const res = await handler(makeRequest({ body: { event: "COUNTER_GET" } }));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RES_CODE.FAIL);
    expect(res.body.message).toBe("boom");
    // 异常响应附带本次请求聚合日志（含 requestId）
    expect(typeof res.body.log).toBe("string");
    expect(res.body.log).toMatch(/Twikoo:\[[0-9a-f-]{36}\]/);
  });

  it("readConfig 失败降级为空配置（请求不失败）", async () => {
    const adapters = createMemoryAdapters();
    adapters.database.getConfig = async () => {
      throw new Error("db down");
    };
    const handler = createHandler(adapters as TkAdapters);
    const res = await handler(makeRequest({ body: { event: "GET_FUNC_VERSION" } }));
    expect(res.body.code).toBe(RES_CODE.SUCCESS);
  });
});

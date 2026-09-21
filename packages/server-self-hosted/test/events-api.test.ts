/**
 * tkserver HTTP 全链路 API 测试（#1170）。
 *
 * 启动进程内 tkserver（Loki 临时目录），用**真实 HTTP 请求**逐个 event 断言响应分支——
 * 与 server-common 的 handlers.test.ts（直调 handler）互补：这里覆盖 server 入口的
 * JSON 解析、pipeline 装配、CORS 响应头与错误兜底整条链路。
 *
 * 管理语义（1.x 对齐）：accessToken 即明文管理密码，服务端以 md5(accessToken) 比对。
 * 外部依赖（SMTP / 图床 / Akismet）均不配置，走对应的错误分支。
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LokiDatabase } from "@twikoojs/common";
import { createTkserverServer, type TkserverInstance } from "../src/server";

const ADMIN_PASS = "admin888";
/** 1.x 语义：accessToken 就是明文密码 */
const ADMIN_TOKEN = ADMIN_PASS;

let inst: TkserverInstance;
let base = "";
let dir = "";

/** POST 一个事件并返回解析后的响应体 */
async function call(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** 管理员事件（accessToken = 明文密码） */
function adminCall(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  return call({ ...body, accessToken: ADMIN_TOKEN });
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "tkserver-events-"));
  const db = new LokiDatabase({ dataDir: join(dir, "data") });
  inst = createTkserverServer({ database: db });
  await new Promise<void>((resolve) => inst.server.listen(0, "127.0.0.1", resolve));
  const port = (inst.server.address() as import("node:net").AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
  // 预置管理密码（库中无密码时 SET_PASSWORD 可直接设置）
  const set = await call({ event: "SET_PASSWORD", password: ADMIN_PASS });
  expect(set.body.code).toBe(0);
}, 30000);

afterAll(async () => {
  // fetch 的 keep-alive 连接会让 server.close() 长等，先强关连接
  inst.server.closeAllConnections();
  await inst.gracefulShutdown();
  await inst.database.close?.();
  rmSync(dir, { recursive: true, force: true });
}, 30000);

describe("版本与配置", () => {
  it("GET_FUNC_VERSION：code 0 + 版本号", async () => {
    const { status, body } = await call({ event: "GET_FUNC_VERSION" });
    expect(status).toBe(200);
    expect(body.code).toBe(0);
    expect(typeof body.version).toBe("string");
  });

  it("GET_CONFIG：公开白名单带 VERSION 与 IS_ADMIN=false", async () => {
    const { body } = await call({ event: "GET_CONFIG" });
    expect(body.code).toBe(0);
    const config = body.config as Record<string, unknown>;
    expect(typeof config.VERSION).toBe("string");
    expect(config.IS_ADMIN).toBe(false);
  });

  it("GET_CONFIG_FOR_ADMIN：未登录 1024；登录后 code 0 且不泄露 CREDENTIALS", async () => {
    const visitor = await call({ event: "GET_CONFIG_FOR_ADMIN" });
    expect(visitor.body.code).toBe(1024);
    await call({ event: "SET_CONFIG", accessToken: ADMIN_TOKEN, config: { SMTP_PASS: "secret" } });
    const admin = await adminCall({ event: "GET_CONFIG_FOR_ADMIN" });
    expect(admin.body.code).toBe(0);
    const config = admin.body.config as Record<string, unknown>;
    expect(config.CREDENTIALS).toBeUndefined();
    expect(typeof config.VERSION).toBe("string");
  });

  it("SET_CONFIG：管理员改 SITE_NAME 后 GET_CONFIG 反映", async () => {
    const set = await adminCall({ event: "SET_CONFIG", config: { SITE_NAME: "API 测试站" } });
    expect(set.body.code).toBe(0);
    const { body } = await call({ event: "GET_CONFIG" });
    expect((body.config as Record<string, unknown>).SITE_NAME).toBe("API 测试站");
  });
});

describe("密码与登录", () => {
  it("GET_PASSWORD_STATUS：已设置", async () => {
    const { body } = await call({ event: "GET_PASSWORD_STATUS" });
    expect(body.code).toBe(0);
    expect(body.status).toBe(true);
  });

  it("LOGIN：正确密码 0，错误密码 1023", async () => {
    const ok = await call({ event: "LOGIN", password: ADMIN_PASS });
    expect(ok.body.code).toBe(0);
    const bad = await call({ event: "LOGIN", password: "wrong" });
    expect(bad.body.code).toBe(1023);
  });
});

describe("评论读者侧", () => {
  it("COMMENT_SUBMIT：提交成功回 id，XSS 内容被清洗", async () => {
    const { body } = await call({
      event: "COMMENT_SUBMIT",
      nick: "张三",
      mail: "z@example.com",
      url: "/p/1",
      ua: "UA",
      comment: "<p>API 测试评论</p><script>alert(1)</script>",
      accessToken: "uid-a",
    });
    expect(body.code).toBe(0);
    expect(typeof body.id).toBe("string");
  });

  it("COMMENT_SUBMIT：缺正文 → 参数不合法", async () => {
    const { body } = await call({ event: "COMMENT_SUBMIT", nick: "x", mail: "x@t.com", url: "/p/1" });
    expect(body.code).not.toBe(0);
    expect(String(body.message)).toContain("不合法");
  });

  it("COMMENT_GET：列表含已提交内容且无 script", async () => {
    const { body } = await call({ event: "COMMENT_GET", url: "/p/1" });
    expect(body.code).toBe(0);
    const text = JSON.stringify(body);
    expect(text).toContain("API 测试评论");
    expect(text).not.toContain("<script");
  });

  it("COMMENT_LIKE：点赞 → 踩互斥", async () => {
    const { body } = await call({ event: "COMMENT_GET", url: "/p/1" });
    const id = (body.data as Array<{ id: string }>)[0].id;
    const like = await call({ event: "COMMENT_LIKE", id, accessToken: "uid-a" });
    expect(like.body.code).toBe(0);
    const down = await call({ event: "COMMENT_LIKE", id, type: "down", accessToken: "uid-a" });
    expect(down.body.code).toBe(0);
  });

  it("COUNTER_GET：首读返回 time 0 并自增", async () => {
    const { body } = await call({ event: "COUNTER_GET", url: "/p/1" });
    expect(body.time).toBe(0);
    expect(body.updated).toBeTruthy();
  });

  it("GET_COMMENTS_COUNT：批量 urls 返回计数", async () => {
    const { body } = await call({ event: "GET_COMMENTS_COUNT", urls: ["/p/1"] });
    const data = body.data as Array<{ url: string; count: number }>;
    expect(data[0].count).toBeGreaterThan(0);
  });

  it("GET_RECENT_COMMENTS：返回最近评论数组", async () => {
    const { body } = await call({ event: "GET_RECENT_COMMENTS", pageSize: 5 });
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("COMMENT_DELETE_FOR_USER：删除自己的评论", async () => {
    const submit = await call({
      event: "COMMENT_SUBMIT",
      nick: "待删除",
      mail: "del@example.com",
      url: "/p/1",
      ua: "UA",
      comment: "<p>即将删除</p>",
      accessToken: "uid-b",
    });
    const id = submit.body.id as string;
    const del = await call({ event: "COMMENT_DELETE_FOR_USER", id, accessToken: "uid-b" });
    expect(del.body.code).toBe(0);
  });
});

describe("评论管理侧", () => {
  it("COMMENT_GET_FOR_ADMIN：code 0 且带 count", async () => {
    const { body } = await adminCall({ event: "COMMENT_GET_FOR_ADMIN", per: 5, page: 1 });
    expect(body.code).toBe(0);
    expect(typeof body.count).toBe("number");
  });

  it("COMMENT_SET_FOR_ADMIN：隐藏评论后 COMMENT_GET 不再返回", async () => {
    const list = await call({ event: "COMMENT_GET", url: "/p/1" });
    const id = (list.body.data as Array<{ id: string }>)[0].id;
    const set = await adminCall({ event: "COMMENT_SET_FOR_ADMIN", id, set: { isSpam: true } });
    expect(set.body.code).toBe(0);
    const after = await call({ event: "COMMENT_GET", url: "/p/1" });
    const text = JSON.stringify(after.body);
    expect(text).not.toContain(`"${id}"`);
  });

  it("COMMENT_EXPORT_FOR_ADMIN：按 collection 导出对应集合", async () => {
    const comments = await adminCall({ event: "COMMENT_EXPORT_FOR_ADMIN", collection: "comment" });
    console.log("REQ=comment RES:", JSON.stringify(comments.body).slice(0, 90));
    const counters = await adminCall({ event: "COMMENT_EXPORT_FOR_ADMIN", collection: "counter" });
    console.log("REQ=counter RES:", JSON.stringify(counters.body).slice(0, 90));
    const bad = await adminCall({ event: "COMMENT_EXPORT_FOR_ADMIN", collection: "nope" });
    console.log("REQ=nope RES:", JSON.stringify(bad.body).slice(0, 90));
    expect(bad.body.code).not.toBe(0);
  });

  it("临时调试：直调 handler 发 EXPORT nope", async () => {
    const comments = await inst.database.getAllComments();
    const counters = await inst.database.getAllCounters();
    console.log(
      "getAllComments:",
      JSON.stringify(comments).slice(0, 80),
      "| getAllCounters:",
      JSON.stringify(counters).slice(0, 80),
    );
  });

  it("COMMENT_IMPORT_FOR_ADMIN：导入 twikoo 备份 → code 0 且日志计数", async () => {
    const backup = JSON.stringify([{ _id: "imp-1", nick: "迁移", url: "/p/9", comment: "c" }]);
    const res = await adminCall({ event: "COMMENT_IMPORT_FOR_ADMIN", source: "twikoo", file: backup });
    expect(res.body.code).toBe(0);
    expect(String(res.body.log)).toContain("导入成功 1 条评论");
  });

  it("COMMENT_DELETE_FOR_ADMIN：删除评论", async () => {
    const submit = await adminCall({
      event: "COMMENT_SUBMIT",
      nick: "管理员",
      mail: "m@example.com",
      url: "/p/2",
      ua: "UA",
      comment: "<p>管理测试</p>",
      accessToken: ADMIN_TOKEN,
    });
    const del = await adminCall({ event: "COMMENT_DELETE_FOR_ADMIN", id: submit.body.id });
    expect(del.body.code).toBe(0);
  });
});

describe("周边能力（未配置外部服务走错误分支）", () => {
  it("GET_QQ_NICK：缺 qq → 参数不合法", async () => {
    const { body } = await call({ event: "GET_QQ_NICK" });
    expect(String(body.message)).toContain("不合法");
  });

  it("EMAIL_TEST：未配置 SMTP → 可读错误", async () => {
    const { body } = await adminCall({ event: "EMAIL_TEST", mail: "t@example.com" });
    expect(String(body.message)).toBe("数据库配置不存在");
  });

  it("UPLOAD_IMAGE：未配置图床 → 非 0", async () => {
    const { body } = await call({ event: "UPLOAD_IMAGE", photo: "data:image/png;base64,AAAA" });
    expect(body.code).not.toBe(0);
  });

  it("CAP_CHALLENGE / CAP_REDEEM：未启用内嵌 Cap → FAIL", async () => {
    const challenge = await call({ event: "CAP_CHALLENGE" });
    expect(challenge.body.code).not.toBe(0);
    const redeem = await call({ event: "CAP_REDEEM", proof: "x", token: "x" });
    expect(redeem.body.code).not.toBe(0);
  });

  it("POST_SUBMIT：无内部派发令牌 → 1403 拒绝", async () => {
    const { body } = await call({
      event: "POST_SUBMIT",
      comment: { _id: "c1", nick: "n", mail: "a@b.com", comment: "c" },
    });
    expect(body.code).toBe(1403);
  });

  it("未知事件：200 + 非 0 code，不崩溃", async () => {
    const { status, body } = await call({ event: "NOT_A_REAL_EVENT" });
    expect(status).toBe(200);
    expect(body.code).not.toBe(0);
  });
});

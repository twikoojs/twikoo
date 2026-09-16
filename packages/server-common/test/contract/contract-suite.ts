/**
 * 26 事件契约套件（规范 §6.7 / §9.2 P0；T19）。
 *
 * 可复用 runner：参数化注入「数据库实现 + 适配器元数据」，把 26 个事件的
 * 请求/响应断言跑在同一套用例上——任何实现漏注册 handler / 漏实现事件，
 * 对应断言（code 0）即红（替代 1.x「各后端 switch 保持一致」的人工约定）。
 * Mongo 与 Loki 两实现均接入；适配器（T20-T24）以各自的 DB 实现接入同一套。
 */
import { expect, describe, it, beforeEach } from "vitest";
import { createHandler } from "../../src/index";
import { createMemoryAdapters, makeRequest } from "../utils/memory-adapters";
import type { Database, TkAdapters } from "../../src/index";
import { md5 } from "../../src/utils/crypto";
import { setCustomLibs, setLibImporter } from "../../src/utils/lib-loader";
import { resetRequestTimes } from "../../src/core/pipeline";

/** 管理密码（契约用固定值；token 即明文密码，1.x 语义） */
export const ADMIN_PASS = "contract-admin-pass";
/** 管理员 accessToken（明文密码，1.x 语义） */
export const ADMIN_TOKEN = ADMIN_PASS;

/** 契约测试夹具：给定数据库实现的完整处理器 */
export interface ContractFixture {
  /** 创建并初始化数据库 */
  createDb: () => Promise<Database>;
  /** 释放资源 */
  disposeDb: (db: Database) => Promise<void>;
}

/**
 * 运行 26 事件契约套件。
 * @param name 实现名（展示用）
 * @param fixture 夹具
 */
export function runContractSuite(name: string, fixture: ContractFixture): void {
  /** 逐用例独立的 handler 与适配器 */
  /** 逐用例独立的 handler 与适配器 */
  let handler: ReturnType<typeof createHandler>;
  /** 逐用例独立的适配器聚合 */
  let adapters: TkAdapters & { database: Database };

  /** 每用例：创建 DB → 组装 handler → 预置管理密码与替身 */
  beforeEach(async () => {
    const db = await fixture.createDb();
    adapters = createMemoryAdapters({ database: db }) as never;
    handler = createHandler(adapters as TkAdapters);
    await adapters.database.saveConfig({ ADMIN_PASS: md5(ADMIN_PASS) });
    // DOMPurify 直通（COMMENT_SUBMIT 消毒；等同 eo-makers 注入形态）
    setCustomLibs({
      DOMPurify: {
        /**
         *
         */
        sanitize: (d) => d,
      },
    });
    // html-to-text 替身（GET_RECENT_COMMENTS 摘要用）
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("html-to-text");
      return {
        /**
         *
         */
        compile: () => (html: string) => html.replace(/<[^>]+>/g, ""),
      };
    });
    resetRequestTimes();
  });

  /**
   * 投递事件（匿名访客）
   * @param body 事件体
   * @returns 响应 Promise
   */
  function post(body: Record<string, unknown>): ReturnType<ReturnType<typeof createHandler>> {
    return handler(makeRequest({ body, ip: "203.0.113.77" }));
  }

  /** 管理员投递 */
  function postAdmin(body: Record<string, unknown>) {
    return post({ ...body, accessToken: ADMIN_TOKEN });
  }

  /** 预置一条评论并返回 id */
  async function seed(overrides: Record<string, unknown> = {}): Promise<string> {
    const doc = await adapters.database.addComment({
      nick: "契约访客",
      url: "/contract",
      comment: "<p>契约评论</p>",
      uid: "contract-user",
      created: 1700000000000,
      updated: 1700000000000,
      ...overrides,
    });
    return doc._id as string;
  }

  describe(`${name} 契约套件（26 事件，§6.7）`, () => {
    // ---- 元事件与健康检查 ----
    it("GET_FUNC_VERSION：code 0 + version", async () => {
      const res = await post({ event: "GET_FUNC_VERSION" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(typeof res.body.version).toBe("string");
    });

    it("空请求体：NO_PARAM + version（1.x 健康检查语义）", async () => {
      const res = await post({});
      expect(res.body.code).toBe(100);
      expect(typeof res.body.version).toBe("string");
    });

    // ---- 评论读写 ----
    it("COMMENT_GET：data 数组 + more/count 字段存在", async () => {
      const id = await seed();
      expect(id).toBeTruthy();
      const res = await post({ event: "COMMENT_GET", url: "/contract" });
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.more).toBe("boolean");
      expect(typeof res.body.count).toBe("number");
    });

    it("COMMENT_GET_FOR_ADMIN：分页参数 + data（含 HIDDEN 筛选形态）", async () => {
      const id = await seed({ isSpam: true });
      void id;
      const res = await postAdmin({
        event: "COMMENT_GET_FOR_ADMIN",
        type: "HIDDEN",
        per: 10,
        page: 1,
      });
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(1);
    });

    it("COMMENT_SET_FOR_ADMIN：更新后 content 可读回", async () => {
      const id = await seed();
      const res = await postAdmin({
        event: "COMMENT_SET_FOR_ADMIN",
        id,
        set: { nick: "改契约" },
      });
      expect(res.body.code).toBe(0);
      expect((await adapters.database.getComment(id))?.nick).toBe("改契约");
    });

    it("COMMENT_DELETE_FOR_ADMIN：删除后查无此评论", async () => {
      const id = await seed();
      const res = await postAdmin({ event: "COMMENT_DELETE_FOR_ADMIN", id });
      expect(res.body.code).toBe(0);
      expect(await adapters.database.getComment(id)).toBeNull();
    });

    it("COMMENT_DELETE_FOR_USER：归属者可删；他人 1000", async () => {
      const id = await seed({ uid: "owner-1" });
      const forbidden = await post({
        event: "COMMENT_DELETE_FOR_USER",
        id,
        accessToken: "someone-else",
      });
      expect(forbidden.body.code).toBe(1000);
      const ok = await post({
        event: "COMMENT_DELETE_FOR_USER",
        id,
        accessToken: "owner-1",
      });
      expect(ok.body.code).toBe(0);
    });

    it("COMMENT_IMPORT_FOR_ADMIN：twikoo 备份导入 → log 回传", async () => {
      const res = await postAdmin({
        event: "COMMENT_IMPORT_FOR_ADMIN",
        source: "twikoo",
        file: JSON.stringify([{ _id: "imp-1", nick: "n", comment: "c", url: "/p" }]),
      });
      expect(res.body.code).toBe(0);
      expect(String(res.body.log)).toContain("导入成功 1 条评论");
    });

    it("COMMENT_EXPORT_FOR_ADMIN：data 数组", async () => {
      await seed();
      const res = await postAdmin({ event: "COMMENT_EXPORT_FOR_ADMIN" });
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("COMMENT_LIKE：赞后 ups 含 uid", async () => {
      const id = await seed();
      const res = await post({ event: "COMMENT_LIKE", id, accessToken: "liker" });
      expect(res.body.code).toBe(0);
      const doc = await adapters.database.getComment(id);
      expect(doc?.ups).toContain("liker");
    });

    it("COMMENT_SUBMIT：id 回传 + 落库（消毒直通）", async () => {
      const res = await post({
        event: "COMMENT_SUBMIT",
        nick: "提交者",
        url: "/contract",
        ua: "UA",
        comment: "<p>新评论</p>",
      });
      expect(res.body.code).toBe(0);
      expect(typeof res.body.id).toBe("string");
      const doc = await adapters.database.getComment(res.body.id as string);
      expect(doc?.nick).toBe("提交者");
    });

    // ---- 计数 ----
    it("COUNTER_GET：首读 0 → 自增", async () => {
      const res = await post({ event: "COUNTER_GET", url: "/contract", title: "t" });
      expect(res.body.time).toBe(0);
      const res2 = await post({ event: "COUNTER_GET", url: "/contract" });
      expect(res2.body.time).toBe(1);
    });

    it("GET_COMMENTS_COUNT：urls 计数", async () => {
      await seed();
      const res = await post({ event: "GET_COMMENTS_COUNT", urls: ["/contract"] });
      expect(res.body.data).toEqual([{ url: "/contract", count: 1 }]);
    });

    it("GET_RECENT_COMMENTS：摘要列表（1.x 成功不带 code，仅 data）", async () => {
      await seed();
      const res = await post({ event: "GET_RECENT_COMMENTS" });
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as Array<{ id: string }>)[0].id).toBeTruthy();
      expect(res.body.data).toHaveLength(1);
    });

    // ---- 密码与配置 ----
    it("GET_PASSWORD_STATUS：status/credentials/version", async () => {
      const res = await post({ event: "GET_PASSWORD_STATUS" });
      expect(res.body.code).toBe(0);
      expect(res.body.status).toBe(true);
      expect(typeof res.body.version).toBe("string");
    });

    it("SET_PASSWORD：已有密码时匿名 → PASS_EXIST；管理员可改", async () => {
      const denied = await post({ event: "SET_PASSWORD", password: "x" });
      expect(denied.body.code).toBe(1010);
      const ok = await postAdmin({ event: "SET_PASSWORD", password: "new-pass" });
      expect(ok.body.code).toBe(0);
      // 新密码登录成功（md5 比对）
      const login = await post({ event: "LOGIN", password: "new-pass" });
      expect(login.body.code).toBe(0);
    });

    it("GET_CONFIG：白名单字段不泄露 SMTP", async () => {
      await adapters.database.saveConfig({ SMTP_PASS: "secret" });
      const res = await post({ event: "GET_CONFIG" });
      expect(res.body.code).toBe(0);
      expect(JSON.stringify(res.body.config)).not.toContain("secret");
    });

    it("GET_CONFIG_FOR_ADMIN：管理员全量（无 CREDENTIALS）", async () => {
      const res = await postAdmin({ event: "GET_CONFIG_FOR_ADMIN" });
      expect(res.body.code).toBe(0);
      expect(res.body.config).toBeTruthy();
      expect(res.body.config).not.toHaveProperty("CREDENTIALS");
    });

    it("SET_CONFIG：管理员写入 → GET_CONFIG 反映", async () => {
      const res = await postAdmin({
        event: "SET_CONFIG",
        config: { SITE_NAME: "契约站" },
      });
      expect(res.body.code).toBe(0);
      const check = await post({ event: "GET_CONFIG" });
      expect((check.body.config as Record<string, unknown>).SITE_NAME).toBe("契约站");
    });

    it("LOGIN：密码错误 PASS_NOT_MATCH；正确 code 0", async () => {
      const bad = await post({ event: "LOGIN", password: "wrong" });
      expect(bad.body.code).toBe(1023);
      const ok = await post({ event: "LOGIN", password: ADMIN_PASS });
      expect(ok.body.code).toBe(0);
    });

    // ---- 邮件/上传/QQ（免密钥形态的失败分支） ----
    it("EMAIL_TEST：访客 NEED_LOGIN", async () => {
      const res = await post({ event: "EMAIL_TEST", mail: "a@b.com" });
      expect(res.body.code).toBe(1024);
    });

    it("UPLOAD_IMAGE：未配置图床 → 1040", async () => {
      const res = await postAdmin({
        event: "UPLOAD_IMAGE",
        photo: "data:image/png;base64,iVBORw0KGgo=",
      });
      expect(res.body.code).toBe(1040);
    });

    it("GET_QQ_NICK：缺 qq → 参数不合法", async () => {
      const res = await post({ event: "GET_QQ_NICK" });
      expect(res.body.message).toBe('参数"qq"不合法');
    });

    // ---- Cap ----
    it("CAP_CHALLENGE / CAP_REDEEM：未启用 → FAIL 提示", async () => {
      const challenge = await post({ event: "CAP_CHALLENGE" });
      expect(challenge.body.code).toBe(1000);
      expect(challenge.body.message).toBe("内嵌 Cap 未启用");
      const redeem = await post({ event: "CAP_REDEEM", token: "t", solutions: [] });
      expect(redeem.body.message).toBe("内嵌 Cap 未启用");
    });

    // ---- 兼容分支（D-4） ----
    it("POST_SUBMIT 兼容分支：code 0（副作用链执行）", async () => {
      const res = await post({
        event: "POST_SUBMIT",
        comment: { _id: "c1", nick: "n", comment: "c" },
      });
      expect(res.body.code).toBe(0);
    });

    it("HIDDEN / VISIBLE 兼容分支：等价于 COMMENT_GET_FOR_ADMIN 的 type", async () => {
      await seed({ isSpam: true });
      const viaCompat = await postAdmin({
        event: "HIDDEN",
        per: 10,
        page: 1,
      });
      const viaType = await postAdmin({
        event: "COMMENT_GET_FOR_ADMIN",
        type: "HIDDEN",
        per: 10,
        page: 1,
      });
      expect(viaCompat.body.code).toBe(0);
      expect(viaCompat.body.data).toEqual(viaType.body.data);
      const visible = await postAdmin({ event: "VISIBLE", per: 10, page: 1 });
      expect(visible.body.code).toBe(0);
      expect(visible.body.data).toEqual([]);
    });
  });
}

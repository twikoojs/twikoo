/**
 * 25 事件 handler 全量测试。
 *
 * 每个 handler 至少 1 happy + 1 failure 用例；重依赖经 setCustomLibs /
 * setLibImporter 替身注入（无真实密钥、无真实网络—— 停机协议不触发）。
 * 管理员 token = md5(ADMIN_PASS)（1.x 客户端本地计算语义）。
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandler, RECURSION_HEADER, RES_CODE } from "../../src/index";
import { createMemoryAdapters, makeRequest } from "../utils/memory-adapters";
import type { TkAdapters } from "../../src/index";
import { md5 } from "../../src/utils/crypto";
import { setCustomLibs } from "../../src/utils/lib-loader";
import { setLibImporter } from "../../src/utils/lib-loader";
import { resetRequestTimes } from "../../src/core/pipeline";

/**
 * 管理密码与对应 token。
 * 1.x 语义：管理面板把「明文密码」作为 accessToken 保存并在管理请求中上送，
 * 服务端 isAdmin 以 md5(accessToken) === ADMIN_PASS(md5) 比对——因此 token
 * 就是明文密码本身。
 */
const ADMIN_PASS = "admin888";
const ADMIN_TOKEN = ADMIN_PASS;

/** 每用例独立的处理器与适配器 */
let handler: ReturnType<typeof createHandler>;
let adapters: TkAdapters;

beforeEach(async () => {
  adapters = createMemoryAdapters();
  handler = createHandler(adapters);
  // 预置管理密码（saveConfig 合并语义）
  await adapters.database.saveConfig({ ADMIN_PASS: md5(ADMIN_PASS) });
  // DOMPurify 直通（避免 jsdom 依赖；等同 eo-makers 注入形态）
  setCustomLibs({
    DOMPurify: {
      /**
       *
       */
      sanitize: (dirty) => dirty,
    },
  });
  resetRequestTimes();
});

afterAll(() => {
  vi.restoreAllMocks();
});

/**
 * 快速投递事件（默认匿名访客）
 * @param body 事件体
 * @param ip 来源 IP
 * @returns 响应 Promise
 */
function post(
  body: Record<string, unknown>,
  ip = "192.0.2.1",
): ReturnType<ReturnType<typeof createHandler>> {
  return handler(makeRequest({ body, ip }));
}

/** 快速投递管理员事件 */
function postAdmin(body: Record<string, unknown>) {
  return post({ ...body, accessToken: ADMIN_TOKEN });
}

/**
 * 预置一条评论
 * @param overrides 覆盖字段
 * @returns 评论 id
 */
async function seed(overrides: Record<string, unknown> = {}): Promise<string> {
  const doc = await adapters.database.addComment({
    nick: "访客",
    url: "/post/1",
    comment: "<p>你好</p>",
    uid: "user-1",
    created: 1700000000000,
    updated: 1700000000000,
    ...overrides,
  });
  return doc._id as string;
}

describe("COMMENT_GET / COMMENT_GET_FOR_ADMIN", () => {
  it("happy：访客读取评论（主楼+回复归组、垃圾不可见、本人垃圾可见）", async () => {
    const id1 = await seed({ nick: "甲" });
    await seed({ nick: "垃圾甲", isSpam: true });
    await seed({ nick: "回复", rid: id1, created: 1700000000001 });
    const res = await post({ event: "COMMENT_GET", url: "/post/1" });
    expect(res.body.code).toBe(0);
    const data = res.body.data as Array<{ id: string; nick: string; replies: unknown[] }>;
    expect(data).toHaveLength(1);
    expect(data[0].nick).toBe("甲");
    expect(data[0].replies).toHaveLength(1);
    expect(res.body.count).toBe(1);
    expect(res.body.more).toBe(false);
  });

  it("happy：本人可在列表中看到自己的垃圾评论（$or uid 语义）", async () => {
    await adapters.database.addComment({
      nick: "本人",
      url: "/post/1",
      comment: "c",
      uid: "user-9",
      isSpam: true,
      created: 1,
    });
    const res = await post({ event: "COMMENT_GET", url: "/post/1", accessToken: "user-9" });
    expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("failure：缺 url → 参数不合法错误体", async () => {
    const res = await post({ event: "COMMENT_GET" });
    expect(res.body.code).toBe(1000);
    expect(res.body.message).toContain('参数"url"不合法');
  });

  it("admin happy：管理员分页读取（VISIBLE 筛选）", async () => {
    await seed({ nick: "正常" });
    await seed({ nick: "隐藏", isSpam: true });
    const res = await postAdmin({
      event: "COMMENT_GET_FOR_ADMIN",
      type: "HIDDEN",
      per: 10,
      page: 1,
    });
    expect(res.body.code).toBe(0);
    expect(res.body.data as unknown[]).toHaveLength(1);
  });

  it("admin failure：未登录 → NEED_LOGIN", async () => {
    const res = await post({ event: "COMMENT_GET_FOR_ADMIN", per: 10, page: 1 });
    expect(res.body.code).toBe(1024);
  });
});

describe("COMMENT_SET_FOR_ADMIN / COMMENT_DELETE_FOR_ADMIN", () => {
  it("admin happy：修改评论内容并刷新 updated", async () => {
    const id = await seed({ nick: "旧名" });
    const res = await postAdmin({ event: "COMMENT_SET_FOR_ADMIN", id, set: { nick: "新名" } });
    expect(res.body.code).toBe(0);
    const doc = await adapters.database.getComment(id);
    expect(doc?.nick).toBe("新名");
    expect(doc?.updated).toBeGreaterThan(1700000000000);
  });

  it("failure：未登录修改 → NEED_LOGIN", async () => {
    const id = await seed();
    const res = await post({ event: "COMMENT_SET_FOR_ADMIN", id, set: { nick: "x" } });
    expect(res.body.code).toBe(1024);
  });

  it("admin happy：删除评论", async () => {
    const id = await seed();
    const res = await postAdmin({ event: "COMMENT_DELETE_FOR_ADMIN", id });
    expect(res.body.code).toBe(0);
    expect(await adapters.database.getComment(id)).toBeNull();
  });

  it("failure：未登录删除 → NEED_LOGIN", async () => {
    const res = await post({ event: "COMMENT_DELETE_FOR_ADMIN", id: "x" });
    expect(res.body.code).toBe(1024);
  });
});

describe("COMMENT_DELETE_FOR_USER", () => {
  it("happy：本人删除自己的评论", async () => {
    const id = await seed({ uid: "user-1" });
    const res = await post({ event: "COMMENT_DELETE_FOR_USER", id, accessToken: "user-1" });
    expect(res.body.code).toBe(0);
    expect(await adapters.database.getComment(id)).toBeNull();
  });

  it("failure：删除他人评论 → 只能删除自己的评论", async () => {
    const id = await seed({ uid: "user-1" });
    const res = await post({ event: "COMMENT_DELETE_FOR_USER", id, accessToken: "attacker" });
    expect(res.body.code).toBe(1000);
    expect(res.body.message).toBe("只能删除自己的评论");
  });
});

describe("COMMENT_IMPORT_FOR_ADMIN / COMMENT_EXPORT_FOR_ADMIN", () => {
  it("admin happy：导入 twikoo 备份并导出", async () => {
    const backup = JSON.stringify([{ _id: "b1", nick: "迁移", url: "/p", comment: "c" }]);
    const res = await postAdmin({
      event: "COMMENT_IMPORT_FOR_ADMIN",
      source: "twikoo",
      file: backup,
    });
    expect(res.body.code).toBe(0);
    expect(res.body.log).toContain("导入成功 1 条评论");
    const all = await adapters.database.getAllComments();
    expect(all.some((c) => c._id === "b1")).toBe(true);
    const exportRes = await postAdmin({ event: "COMMENT_EXPORT_FOR_ADMIN" });
    expect((exportRes.body.data as unknown[]).length).toBe(1);
  });

  it("failure：未登录导入 → NEED_LOGIN；未知来源写入日志", async () => {
    const res = await post({ event: "COMMENT_IMPORT_FOR_ADMIN", source: "twikoo", file: "[]" });
    expect(res.body.code).toBe(1024);
    const res2 = await postAdmin({
      event: "COMMENT_IMPORT_FOR_ADMIN",
      source: "unknown-src",
      file: "[]",
    });
    expect(res2.body.log).toContain("不支持 unknown-src");
  });
});

describe("COMMENT_LIKE", () => {
  it("happy：点赞 → 取消；赞踩互斥", async () => {
    const id = await seed();
    await post({ event: "COMMENT_LIKE", id, accessToken: "u1" });
    expect((await adapters.database.getComment(id))?.ups as string[]).toContain("u1");
    // 踩 cancels 赞
    await post({ event: "COMMENT_LIKE", id, type: "down", accessToken: "u1" });
    const doc = await adapters.database.getComment(id);
    expect(doc?.downs).toContain("u1");
    expect(doc?.ups).not.toContain("u1");
    // 再次踩 = 取消
    await post({ event: "COMMENT_LIKE", id, type: "down", accessToken: "u1" });
    expect((await adapters.database.getComment(id))?.downs as string[]).toHaveLength(0);
  });

  it("failure：缺 id → 参数不合法", async () => {
    const res = await post({ event: "COMMENT_LIKE" });
    expect(res.body.message).toBe('参数"id"不合法');
  });
});

describe("COMMENT_SUBMIT（含 postSubmit 副作用链）", () => {
  it("happy：提交评论（消毒、归属、id 回传）", async () => {
    const res = await post({
      event: "COMMENT_SUBMIT",
      nick: "张三",
      mail: "z@example.com",
      url: "/p/1",
      href: "https://blog.test/p/1",
      ua: "Mozilla/5.0",
      comment: "<p>留言<b>加粗</b></p>",
    });
    expect(res.body.code).toBe(0);
    expect(typeof res.body.id).toBe("string");
    const all = await adapters.database.getAllComments();
    expect(all[0].nick).toBe("张三");
    expect(all[0].isSpam).toBe(false);
    expect(all[0].uid).toBe(res.body.accessToken);
  });

  it("failure：缺 ua → 参数不合法", async () => {
    const res = await post({ event: "COMMENT_SUBMIT", url: "/p/1", comment: "c" });
    expect(res.body.message).toBe('参数"ua"不合法');
  });

  it("failure：超长评论 → 评论内容过长", async () => {
    const res = await post({
      event: "COMMENT_SUBMIT",
      url: "/p/1",
      ua: "UA",
      comment: "x".repeat(600),
    });
    expect(res.body.message).toBe("评论内容过长");
  });

  it("FORBIDDEN_WORDS：评论入库但标记垃圾", async () => {
    const res = await handler(
      makeRequest({
        body: {
          event: "COMMENT_SUBMIT",
          nick: "n",
          url: "/p/1",
          ua: "UA",
          comment: "正常内容",
        },
        ip: "203.0.113.5",
      }),
    );
    void res;
    // 配置违禁词后重提交
    await adapters.database.saveConfig({ FORBIDDEN_WORDS: "违禁词" });
    const res2 = await post({
      event: "COMMENT_SUBMIT",
      nick: "违禁词推销",
      url: "/p/1",
      ua: "UA",
      comment: "普通内容",
    });
    expect(res2.body.code).toBe(0);
    const all = await adapters.database.getAllComments();
    expect(all.find((c) => c.nick === "违禁词推销")?.isSpam).toBe(true);
  });

  it("BLOCKED_WORDS：命中屏蔽词直接报错", async () => {
    await adapters.database.saveConfig({ BLOCKED_WORDS: "赌博" });
    const res = await post({
      event: "COMMENT_SUBMIT",
      nick: "n",
      url: "/p/1",
      ua: "UA",
      comment: " Online 赌博 ",
    });
    expect(res.body.message).toBe("包含屏蔽词");
  });

  it("发表频率限制（LIMIT_PER_MINUTE，1.x 严格大于语义）", async () => {
    await adapters.database.saveConfig({ LIMIT_PER_MINUTE: "1" });
    // 窗口内 0 条 → 放行；1 条 → 1 > 1 不成立 → 仍放行；2 条 → 拦截
    await post({ event: "COMMENT_SUBMIT", nick: "n", url: "/p/1", ua: "UA", comment: "c1" });
    await post({ event: "COMMENT_SUBMIT", nick: "n", url: "/p/1", ua: "UA", comment: "c2" });
    const res = await post({
      event: "COMMENT_SUBMIT",
      nick: "n",
      url: "/p/1",
      ua: "UA",
      comment: "c3",
    });
    expect(res.body.message).toBe("发言频率过高");
  });
});

describe("COUNTER_GET / GET_COMMENTS_COUNT / GET_RECENT_COMMENTS", () => {
  it("counter happy：首读 time 0 → 自增 1", async () => {
    const res = await post({ event: "COUNTER_GET", url: "/p/1", title: "标题" });
    expect(res.body.time).toBe(0);
    expect(res.body.updated).toBeTruthy();
    const res2 = await post({ event: "COUNTER_GET", url: "/p/1" });
    expect(res2.body.time).toBe(1);
  });

  it("counter failure：缺 url → message 错误体", async () => {
    const res = await post({ event: "COUNTER_GET" });
    expect(res.body.message).toBe('参数"url"不合法');
  });

  it("comments count happy：不含回复；垃圾不计", async () => {
    const id = await seed({});
    await seed({ rid: id, url: "/post/1" });
    await seed({ isSpam: true });
    const res = await post({ event: "GET_COMMENTS_COUNT", urls: ["/post/1"] });
    expect(res.body.data).toEqual([{ url: "/post/1", count: 1 }]);
    const res2 = await post({
      event: "GET_COMMENTS_COUNT",
      urls: ["/post/1"],
      includeReply: true,
    });
    expect(res2.body.data).toEqual([{ url: "/post/1", count: 2 }]);
  });

  it("count failure：缺 urls → 参数不合法", async () => {
    const res = await post({ event: "GET_COMMENTS_COUNT" });
    expect(res.body.message).toBe('参数"urls"不合法');
  });

  it("recent happy：最新评论摘要（非垃圾优先、含 commentText）", async () => {
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("html-to-text");
      return {
        /**
         *
         */
        compile: () => (html: string) => html.replace(/<[^>]+>/g, ""),
      };
    });
    await seed({ nick: "甲", created: 1000 });
    await seed({ nick: "乙", created: 2000, isSpam: true });
    await seed({ nick: "丙", created: 3000 });
    const res = await post({ event: "GET_RECENT_COMMENTS" });
    const data = res.body.data as Array<{ nick: string; commentText: string }>;
    expect(data.map((d) => d.nick)).toEqual(["丙", "甲"]);
    expect(typeof data[0].commentText).toBe("string");
  });
});

describe("SET_PASSWORD / GET_PASSWORD_STATUS / LOGIN", () => {
  it("happy：设置密码 → 状态为已设置 → 正确密码登录 → 错误密码 PASS_NOT_MATCH", async () => {
    // 先清掉预置密码验证「无密码可直接设置」
    await adapters.database.saveConfig({ ADMIN_PASS: "" });
    const set = await post({ event: "SET_PASSWORD", password: "newpass" });
    expect(set.body.code).toBe(0);
    const status = await post({ event: "GET_PASSWORD_STATUS" });
    expect(status.body.status).toBe(true);
    const ok = await post({ event: "LOGIN", password: "newpass" });
    expect(ok.body.code).toBe(0);
    const bad = await post({ event: "LOGIN", password: "wrong" });
    expect(bad.body.code).toBe(1023);
  });

  it("failure：已有密码时非管理员设置 → PASS_EXIST", async () => {
    const res = await post({ event: "SET_PASSWORD", password: "another" });
    expect(res.body.code).toBe(1010);
  });

  it("failure：库中无密码时缺 password → 参数不合法", async () => {
    await adapters.database.saveConfig({ ADMIN_PASS: "" });
    const res = await post({ event: "SET_PASSWORD" });
    expect(res.body.message).toBe('参数"password"不合法');
  });
});

describe("GET_CONFIG / GET_CONFIG_FOR_ADMIN / SET_CONFIG", () => {
  it("happy：公开配置白名单（不泄露 SMTP 密钥）", async () => {
    await adapters.database.saveConfig({ SMTP_PASS: "secret", SITE_NAME: "测试站" });
    const res = await post({ event: "GET_CONFIG" });
    expect((res.body.config as Record<string, unknown>).SITE_NAME).toBe("测试站");
    expect(JSON.stringify(res.body.config)).not.toContain("secret");
    expect((res.body.config as Record<string, unknown>).SHOW_IMAGE).toBe("true");
  });

  it("admin happy/failure：全量配置摘除 CREDENTIALS；未登录 NEED_LOGIN", async () => {
    await adapters.database.saveConfig({ SMTP_PASS: "secret", CREDENTIALS: "cred" });
    const admin = await postAdmin({ event: "GET_CONFIG_FOR_ADMIN" });
    const adminConfig = admin.body.config as Record<string, unknown>;
    expect(adminConfig.SMTP_PASS).toBe("secret");
    expect(adminConfig.CREDENTIALS).toBeUndefined();
    const visitor = await post({ event: "GET_CONFIG_FOR_ADMIN" });
    expect(visitor.body.code).toBe(1024);
  });

  it("set config：管理员改配置生效；未登录拒绝", async () => {
    const ok = await postAdmin({ event: "SET_CONFIG", config: { SITE_NAME: "新站名" } });
    expect(ok.body.code).toBe(0);
    const cfg = await post({ event: "GET_CONFIG" });
    expect((cfg.body.config as Record<string, unknown>).SITE_NAME).toBe("新站名");
    const denied = await post({ event: "SET_CONFIG", config: { SITE_NAME: "x" } });
    expect(denied.body.code).toBe(1024);
  });
});

describe("EMAIL_TEST / UPLOAD_IMAGE / GET_QQ_NICK（重依赖替身注入）", () => {
  it("email test：未登录 NEED_LOGIN；管理员无 SMTP 配置 → 友好错误", async () => {
    const visitor = await post({ event: "EMAIL_TEST", mail: "a@b.com" });
    expect(visitor.body.code).toBe(1024);
    const admin = await postAdmin({ event: "EMAIL_TEST", mail: "a@b.com" });
    expect(admin.body.message).toBe("数据库配置不存在");
  });

  it("upload image：未配置图床 → UPLOAD_FAILED 1040", async () => {
    const res = await postAdmin({
      event: "UPLOAD_IMAGE",
      photo: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(res.body.code).toBe(1040);
    expect(res.body.err).toBe("未配置图片上传服务");
  });

  it("qq nick：缺 qq 报错；替身 axios 返回昵称", async () => {
    const bad = await post({ event: "GET_QQ_NICK" });
    expect(bad.body.message).toBe('参数"qq"不合法');
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("axios");
      return {
        default: {
          /**
           *
           */
          get: async () => ({ data: { code: 200, data: { nick: "QQ昵称" } } }),
        },
      };
    });
    const ok = await post({ event: "GET_QQ_NICK", qq: "12345" });
    expect(ok.body.code).toBe(0);
    expect(ok.body.nick).toBe("QQ昵称");
  });
});

describe("CAP_CHALLENGE / CAP_REDEEM（内嵌 Cap）", () => {
  it("未启用内嵌 Cap → FAIL 提示", async () => {
    const res = await post({ event: "CAP_CHALLENGE" });
    expect(res.body.code).toBe(1000);
    expect(res.body.message).toBe("内嵌 Cap 未启用");
  });

  it("启用内嵌 Cap：签发挑战 + 兑换参数校验", async () => {
    await adapters.database.saveConfig({ CAPTCHA_PROVIDER: "Cap" });
    const res = await post({ event: "CAP_CHALLENGE" });
    expect(res.body.code).toBe(0);
    // 无 token/solutions 的兑换 → success false（1.x 兼容）
    const redeem = await post({ event: "CAP_REDEEM" });
    expect(redeem.body.code).toBe(0);
    expect(redeem.body.success).toBe(false);
  });
});

describe("POST_SUBMIT（后置副作用链执行入口 + 内部派发令牌校验）", () => {
  it("带内部派发令牌：执行垃圾检测+通知（空配置下安全跳过）并返回成功", async () => {
    await adapters.database.saveConfig({ NOTIFY_SPAM: "false" });
    const res = await handler(
      makeRequest({
        body: {
          event: "POST_SUBMIT",
          comment: { _id: "c1", nick: "n", mail: "a@b.com", comment: "c" },
        },
        // 令牌 = config.ADMIN_PASS；本文件 beforeEach 存入的是 md5(ADMIN_PASS)
        headers: { [RECURSION_HEADER]: md5(ADMIN_PASS) },
      }),
    );
    expect(res.body.code).toBe(RES_CODE.SUCCESS);
  });

  it("无令牌（外部直接调用）：1403 拒绝，不触发垃圾检测与通知", async () => {
    const res = await post({
      event: "POST_SUBMIT",
      comment: { _id: "c1", nick: "n", mail: "a@b.com", comment: "c" },
    });
    expect(res.body.code).toBe(RES_CODE.FORBIDDEN);
  });
});

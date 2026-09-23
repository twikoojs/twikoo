/**
 * D1Database 测试（真实 SQL：经 `node:sqlite` 替身执行）。
 *
 * 覆盖：建表与幂等、CRUD、扩展字段往返、语义查询六种形态、排序分页、计数器、
 * 配置合并、Cap KV 与过期清理、批量导入，以及**1.x D1 既有库的升级路径**。
 */
import { describe, expect, it } from "vitest";
import { ABSENT, GT, LT, NOT } from "@twikoojs/common";
import type { CommentDoc } from "@twikoojs/common";
import { D1Database } from "../../src/database/d1";
import { resetSchemaCache } from "../../src/database/schema";
import { lookupRegion, rememberRegion, resetGeoStore } from "../../src/geo/region-store";
import { createSqliteD1 } from "../utils/sqlite-d1";
import type { SqliteD1 } from "../utils/sqlite-d1";

/**
 * 建库并初始化。
 * @param schema 可选的预置 SQL（模拟既有库）
 * @returns 数据库实现与底层绑定
 */
async function makeDb(schema?: string): Promise<{ db: D1Database; binding: SqliteD1 }> {
  const binding = createSqliteD1(schema);
  const db = new D1Database(binding);
  await db.init();
  return { db, binding };
}

/** 一条最小评论 */
function comment(overrides: Partial<CommentDoc> = {}): CommentDoc {
  return {
    nick: "访客",
    mail: "",
    link: "",
    ua: "UA",
    ip: "1.2.3.4",
    url: "/post/1",
    href: "https://example.com/post/1",
    comment: "<p>你好</p>",
    created: 1_700_000_000_000,
    updated: 1_700_000_000_000,
    ...overrides,
  };
}

/** 1.x twikoo-cloudflare 的 comment 表（无 extra 列，主键为 (url, created)） */
const LEGACY_SCHEMA = `
CREATE TABLE comment (
  _id TEXT NOT NULL,
  uid TEXT NOT NULL,
  nick TEXT NOT NULL,
  mail TEXT NOT NULL,
  mailMd5 TEXT NOT NULL,
  link TEXT NOT NULL,
  ua TEXT NOT NULL,
  ip TEXT NOT NULL,
  ipRegion TEXT NOT NULL DEFAULT '',
  master INTEGER NOT NULL,
  url TEXT NOT NULL,
  href TEXT NOT NULL,
  comment TEXT NOT NULL,
  pid TEXT NOT NULL,
  rid TEXT NOT NULL,
  isSpam INTEGER NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  like TEXT NOT NULL,
  top INTEGER NOT NULL,
  avatar TEXT NOT NULL,
  PRIMARY KEY (url, created DESC)
);
CREATE TABLE config (value TEXT NOT NULL);
CREATE TABLE counter (url TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL, time INTEGER NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL);
`;

describe("D1Database · 建表", () => {
  it("init 建表且幂等（同一绑定重复 init / 重复实例均不报错）", async () => {
    const binding = createSqliteD1();
    const db = new D1Database(binding);
    await db.init();
    await db.init();
    // 换一个实例（模拟冷启动）再跑一次：IF NOT EXISTS 幂等
    await new D1Database(binding).init();
    expect(await db.getAllComments()).toEqual([]);
    expect(await db.getAllCounters()).toEqual([]);
  });

  it("init 失败不写进缓存：修好绑定后下一次请求可恢复（不缓存失败的 promise）", async () => {
    resetSchemaCache();
    const broken = { prepare: () => { throw new Error("boom"); } };
    await expect(new D1Database(broken as never).init()).rejects.toThrow("boom");
    const ok = createSqliteD1();
    await expect(new D1Database(ok).init()).resolves.toBeUndefined();
  });
});

describe("D1Database · 评论 CRUD", () => {
  it("add → get：回填 _id，布尔列往返为布尔值", async () => {
    const { db } = await makeDb();
    const saved = await db.addComment(comment({ master: true, isSpam: false, top: true }));
    expect(saved._id).toMatch(/^[0-9a-f]{32}$/);
    const found = await db.getComment(saved._id as string);
    expect(found).not.toBeNull();
    expect(found?.nick).toBe("访客");
    expect(found?.master).toBe(true);
    expect(found?.top).toBe(true);
    expect(found?.isSpam).toBe(false);
    expect(found?.like).toEqual([]);
    expect(found?.created).toBe(1_700_000_000_000);
  });

  it("getComment：不存在返回 null", async () => {
    const { db } = await makeDb();
    expect(await db.getComment("nope")).toBeNull();
  });

  it("update：只改提及字段（含布尔→0/1 编码）", async () => {
    const { db } = await makeDb();
    const saved = await db.addComment(comment());
    await db.updateComment(saved._id as string, { isSpam: true, like: ["u1", "u2"] });
    const found = await db.getComment(saved._id as string);
    expect(found?.isSpam).toBe(true);
    expect(found?.like).toEqual(["u1", "u2"]);
    expect(found?.nick).toBe("访客");
    expect(found?.updated).toBe(1_700_000_000_000);
  });

  it("delete：按 id 删除", async () => {
    const { db } = await makeDb();
    const saved = await db.addComment(comment());
    await db.deleteComment(saved._id as string);
    expect(await db.getComment(saved._id as string)).toBeNull();
  });

  it("扩展字段（CommentDoc 索引签名）经 extra 列往返：ups/downs 与自定义字段都不丢", async () => {
    const { db } = await makeDb();
    const saved = await db.addComment(
      comment({ ups: ["a"], downs: ["b"], customField: { nested: 1 } } as Partial<CommentDoc>),
    );
    const found = await db.getComment(saved._id as string);
    expect(found?.ups).toEqual(["a"]);
    expect(found?.downs).toEqual(["b"]);
    expect(found?.customField).toEqual({ nested: 1 });

    // 局部更新：合并进 extra，不能把别的扩展字段抹掉
    await db.updateComment(saved._id as string, { downs: ["c"] });
    const after = await db.getComment(saved._id as string);
    expect(after?.downs).toEqual(["c"]);
    expect(after?.ups).toEqual(["a"]);
    expect(after?.customField).toEqual({ nested: 1 });
  });

  it("未知字段可作为查询条件（json_extract 回落）", async () => {
    const { db } = await makeDb();
    await db.addComment(comment({ marker: "hit" } as Partial<CommentDoc>));
    await db.addComment(comment({ marker: "miss", url: "/post/2" } as Partial<CommentDoc>));
    const matched = await db.getComments({ marker: "hit" } as never);
    expect(matched).toHaveLength(1);
    expect(matched[0].url).toBe("/post/1");
  });

  it("bulkAddComments：逐条写入，全部可读", async () => {
    const { db } = await makeDb();
    await db.bulkAddComments([comment({ url: "/a" }), comment({ url: "/b" }), comment({ url: "/c" })]);
    expect(await db.countComments({})).toBe(3);
  });
});

describe("D1Database · 语义查询", () => {
  /** 构造一份带层级与状态的样本 */
  async function seed(): Promise<D1Database> {
    const { db } = await makeDb();
    await db.addComment(comment({ _id: "m1", url: "/p", rid: "", created: 1000 }));
    await db.addComment(comment({ _id: "m2", url: "/p", rid: "", created: 2000 }));
    await db.addComment(comment({ _id: "r1", url: "/p", rid: "m1", created: 3000 }));
    await db.addComment(comment({ _id: "s1", url: "/p", rid: "", created: 4000, isSpam: true }));
    await db.addComment(comment({ _id: "o1", url: "/other", rid: "", created: 5000, ip: "9.9.9.9" }));
    return db;
  }

  it("ABSENT（顶级评论）：命中 null / 空串，不命中回复", async () => {
    const db = await seed();
    const main = await db.getComments({ rid: ABSENT });
    expect(main.map((c) => c._id).sort()).toEqual(["m1", "m2", "o1", "s1"]);
  });

  it("NOT（非垃圾）：缺列视为不等于（Mongo $ne 语义）", async () => {
    const db = await seed();
    const visible = await db.getComments({ url: "/p", isSpam: { [NOT]: true } });
    expect(visible.map((c) => c._id).sort()).toEqual(["m1", "m2", "r1"]);
  });

  it("GT / LT：时间窗口与流式分页游标", async () => {
    const db = await seed();
    expect((await db.getComments({ created: { [GT]: 2000 } })).map((c) => c._id).sort()).toEqual([
      "o1",
      "r1",
      "s1",
    ]);
    expect((await db.getComments({ created: { [LT]: 3000 } })).map((c) => c._id).sort()).toEqual([
      "m1",
      "m2",
    ]);
  });

  it("数组与 $in 都是「属于集合之一」；空集合恒假（不生成非法 SQL）", async () => {
    const db = await seed();
    expect((await db.getComments({ _id: ["m1", "o1"] })).map((c) => c._id).sort()).toEqual([
      "m1",
      "o1",
    ]);
    expect((await db.getComments({ rid: { $in: ["m1"] } } as never)).map((c) => c._id)).toEqual([
      "r1",
    ]);
    expect(await db.getComments({ _id: [] })).toEqual([]);
  });

  it("多条件与 countComments：与 Mongo/Loki 语义一致", async () => {
    const db = await seed();
    const query = { url: { $in: ["/p", "/p/"] } as never, rid: ABSENT, isSpam: { [NOT]: true } };
    expect(await db.countComments(query as never)).toBe(2);
  });

  it("未知语义形态早失败（不静默返回空集）", async () => {
    const db = await seed();
    await expect(db.getComments({ rid: { weird: 1 } } as never)).rejects.toThrow("不支持该形态");
  });

  it("排序 + skip/limit（1.x 分页语义）", async () => {
    const db = await seed();
    const page1 = await db.getComments({}, { sort: { created: -1 }, limit: 2 });
    expect(page1.map((c) => c._id)).toEqual(["o1", "s1"]);
    const page2 = await db.getComments({}, { sort: { created: -1 }, skip: 2, limit: 2 });
    expect(page2.map((c) => c._id)).toEqual(["r1", "m2"]);
    // 只给 skip（无 limit）：SQLite 需要 LIMIT 才能 OFFSET
    const rest = await db.getComments({}, { sort: { created: 1 }, skip: 4 });
    expect(rest.map((c) => c._id)).toEqual(["o1"]);
    // 未知排序字段被忽略（不生成非法 SQL）
    const ignored = await db.getComments({}, { sort: { customField: -1 } as never, limit: 1 });
    expect(ignored).toHaveLength(1);
  });
});

describe("D1Database · 计数与配置", () => {
  it("incCounter：首次创建、再次累加、title 缺省时保留既有标题", async () => {
    const { db } = await makeDb();
    const first = await db.incCounter("/p", "标题");
    expect(first.time).toBe(1);
    expect(first.title).toBe("标题");
    const second = await db.incCounter("/p");
    expect(second.time).toBe(2);
    expect(second.title).toBe("标题");
    const third = await db.incCounter("/p", "新标题");
    expect(third.time).toBe(3);
    expect(third.title).toBe("新标题");
    expect((await db.getAllCounters()).map((c) => c.url)).toEqual(["/p"]);
    expect(await db.getCounter("/missing")).toBeNull();
  });

  it("config：无行返回 null；保存为合并语义；可反复覆盖", async () => {
    const { db } = await makeDb();
    expect(await db.getConfig()).toBeNull();
    await db.saveConfig({ ADMIN_PASS: "hash", SITE_URL: "https://a" });
    expect(await db.getConfig()).toEqual({ ADMIN_PASS: "hash", SITE_URL: "https://a" });
    await db.saveConfig({ SITE_URL: "https://b" });
    expect(await db.getConfig()).toEqual({ ADMIN_PASS: "hash", SITE_URL: "https://b" });
    // 反复保存不会插出第二行（单行表形态）
    await db.saveConfig({ X: 1 });
    expect(await db.getConfig()).toEqual({ ADMIN_PASS: "hash", SITE_URL: "https://b", X: 1 });
  });

  it("config：脏 JSON 返回 null（pipeline 会降级为空配置，不能抛）", async () => {
    const binding = createSqliteD1(`CREATE TABLE config (value TEXT NOT NULL); INSERT INTO config (value) VALUES ('{oops');`);
    const db = new D1Database(binding);
    await db.init();
    expect(await db.getConfig()).toBeNull();
  });
});

describe("D1Database · Cap 验证码 KV", () => {
  it("set / get / del 往返，值为 JSON", async () => {
    const { db } = await makeDb();
    expect(await db.capGet("cap:c:t1")).toBeNull();
    await db.capSet("cap:c:t1", { challenge: "abc", expires: 100 });
    expect(await db.capGet("cap:c:t1")).toEqual({ challenge: "abc", expires: 100 });
    await db.capSet("cap:c:t1", { challenge: "def", expires: 200 });
    expect(await db.capGet("cap:c:t1")).toEqual({ challenge: "def", expires: 200 });
    await db.capDel("cap:c:t1");
    expect(await db.capGet("cap:c:t1")).toBeNull();
  });

  it("capDeleteExpired：按 expires 下推删除并返回条数（无 expires 的记录保留）", async () => {
    const { db } = await makeDb();
    await db.capSet("cap:c:old", { expires: 100 });
    await db.capSet("cap:t:old", { expires: 150 });
    await db.capSet("cap:c:new", { expires: 999 });
    await db.capSet("cap:other", { foo: 1 });
    expect(await db.capDeleteExpired(200)).toBe(2);
    expect(await db.capGet("cap:c:new")).toEqual({ expires: 999 });
    expect(await db.capGet("cap:other")).toEqual({ foo: 1 });
  });
});

describe("D1Database · 1.x 既有库升级", () => {
  it("1.x 表结构 + 既有数据可直接读写（init 自动补 extra 列）", async () => {
    const binding = createSqliteD1(LEGACY_SCHEMA);
    // 1.x 时期留下的评论（21 列整行写入，含 ipRegion）
    await binding
      .prepare(`INSERT INTO comment VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        "legacy1",
        "u",
        "老用户",
        "m@example.com",
        "md5",
        "",
        "UA",
        "8.8.8.8",
        "CN|0|广东省|深圳市|",
        0,
        "/p",
        "https://example.com/p",
        "<p>旧评论</p>",
        "",
        "",
        0,
        1000,
        1000,
        "[]",
        0,
        "",
      )
      .run();
    await binding.prepare(`INSERT INTO config (value) VALUES ('{"ADMIN_PASS":"legacy"}')`).run();

    const db = new D1Database(binding);
    await db.init();

    // 旧评论可读（extra 列缺失也不影响）
    const old = await db.getComment("legacy1");
    expect(old?.nick).toBe("老用户");
    expect(old?.ipRegion).toBe("CN|0|广东省|深圳市|");

    // 旧配置可读，且保存仍是合并语义
    expect(await db.getConfig()).toEqual({ ADMIN_PASS: "legacy" });
    await db.saveConfig({ SITE_URL: "https://new" });
    expect(await db.getConfig()).toEqual({ ADMIN_PASS: "legacy", SITE_URL: "https://new" });

    // 新评论可写（extra 列已由迁移补上）
    const fresh = await db.addComment(comment({ url: "/p" }));
    expect(await db.getComment(fresh._id as string)).not.toBeNull();
    expect(await db.countComments({ url: "/p" })).toBe(2);

    // 旧计数表可继续自增
    const counter = await db.incCounter("/p", "页面");
    expect(counter.time).toBe(1);
    expect((await db.incCounter("/p")).time).toBe(2);
  });
});

describe("D1Database · 与属地缓存联动", () => {
  it("addComment 把「本次请求属地」落库（request.cf 通路）", async () => {
    resetGeoStore();
    const { db } = await makeDb();
    rememberRegion("1.2.3.4", "CN|0|广东省|深圳市|");
    const saved = await db.addComment(comment({ ip: "1.2.3.4" }));
    expect(saved.ipRegion).toBe("CN|0|广东省|深圳市|");
    const found = await db.getComment(saved._id as string);
    expect(found?.ipRegion).toBe("CN|0|广东省|深圳市|");
  });

  it("读取评论时把库里的属地回填进缓存（DTO 层按 ip 反查属地时同步命中）", async () => {
    resetGeoStore();
    const { db } = await makeDb();
    await db.addComment(comment({ ip: "8.8.4.4", ipRegion: "US|0|California|Seattle|" }));
    // 模拟「跨请求读历史评论」：新请求缓存为空，靠读库回填
    resetGeoStore();
    expect(lookupRegion("8.8.4.4")).toBeUndefined();
    await db.getComments({ url: "/post/1" });
    expect(lookupRegion("8.8.4.4")).toBe("US|0|California|Seattle|");
  });

  it("已有属地不覆盖（导入数据自带的属地优先）", async () => {
    resetGeoStore();
    const { db } = await makeDb();
    rememberRegion("1.2.3.4", "CN|0|广东省|深圳市|");
    const saved = await db.addComment(comment({ ip: "1.2.3.4", ipRegion: "JP|0|Tokyo|Tokyo|" }));
    expect(saved.ipRegion).toBe("JP|0|Tokyo|Tokyo|");
  });
});

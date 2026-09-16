/**
 * Database 语义套件（§6.4「抽象要抓语义」的测试落地；R-3 跨库一致性保障）。
 *
 * 同一套断言由 Mongo（mongodb-memory-server）与 Loki（临时目录）两个实现
 * 分别执行：任何实现语义偏离（rid ABSENT、排序、分页、计数、配置、验证码、
 * CRUD）即红。T16 的 BlobKv/CloudBase 实现同样接入。
 */
import { expect, describe, it } from "vitest";
import type { CommentDoc, Database, SemanticQuery } from "../../src/ports/database";
import { ABSENT } from "../../src/ports/database";

/** 被测数据库的创建/销毁句柄 */
export interface DbFixture {
  /** 创建并初始化一个全新数据库实例 */
  create: () => Promise<Database>;
  /** 销毁实例并清理资源 */
  dispose: (db: Database) => Promise<void>;
}

/**
 * 构造一条测试评论（默认顶级、未标记垃圾）。
 * @param overrides 覆盖字段
 * @param seed 固定 id/时间基（默认自动）
 * @returns 评论文档
 */
export function makeComment(overrides: Partial<CommentDoc> = {}, seed = 0): CommentDoc {
  return {
    _id: `comment-${seed}-${Math.random().toString(36).slice(2, 10)}`,
    nick: `访客${seed}`,
    mail: `user${seed}@example.com`,
    url: "/post/1",
    comment: `<p>评论内容 ${seed}</p>`,
    created: 1700000000000 + seed,
    updated: 1700000000000 + seed,
    ...overrides,
  };
}

/**
 * 运行数据库语义套件。
 * @param name 实现名（展示用）
 * @param fixture 被测实现的创建/销毁句柄
 */
export function runDatabaseSemanticSuite(name: string, fixture: DbFixture): void {
  describe(`${name} 语义套件（§6.4 / R-3）`, () => {
    it("CRUD：新增→读取→部分更新→删除，实现为缺失 _id 生成 32 位字符串主键", async () => {
      const db = await fixture.create();
      try {
        // _id 置 undefined：走「实现自动生成主键」路径（1.x parse() 语义）
        const added = await db.addComment(makeComment({ _id: undefined, nick: "写入者" }));
        // 1.x 语义：_id 为 uuid 去连字符的 32 位字符串
        expect(added._id).toMatch(/^[0-9a-f]{32}$/);
        const fetched = await db.getComment(added._id as string);
        expect(fetched?.nick).toBe("写入者");
        await db.updateComment(added._id as string, { nick: "改名字", isSpam: true });
        const updated = await db.getComment(added._id as string);
        // 部分更新：新字段生效，未提及字段保持
        expect(updated?.nick).toBe("改名字");
        expect(updated?.isSpam).toBe(true);
        expect(updated?.comment).toBe(added.comment);
        await db.deleteComment(added._id as string);
        expect(await db.getComment(added._id as string)).toBeNull();
      } finally {
        await fixture.dispose(db);
      }
    });

    it("rid ABSENT 语义：同时命中字段缺失、null、空串三种顶级评论形态（R-3）", async () => {
      const db = await fixture.create();
      try {
        // 四种形态：缺失 / null / 空串 / 真实回复
        const a = await db.addComment(makeComment({ rid: undefined }, 1));
        const b = await db.addComment(makeComment({ rid: null }, 2));
        const c = await db.addComment(makeComment({ rid: "" }, 3));
        const d = await db.addComment(makeComment({ rid: a._id }, 4));
        const tops = await db.getComments({ rid: ABSENT } as SemanticQuery);
        const topIds = tops.map((t) => t._id).sort();
        expect(topIds).toEqual([b._id, c._id, a._id].sort());
        // 回复按 rid 等值查询
        const replies = await db.getComments({ rid: a._id as string });
        expect(replies.map((r) => r._id)).toEqual([d._id]);
      } finally {
        await fixture.dispose(db);
      }
    });

    it("等值与 $in 集合查询：isSpam 精确匹配、url 多值命中", async () => {
      const db = await fixture.create();
      try {
        const keep = await db.addComment(makeComment({ url: "/a", isSpam: false }, 1));
        await db.addComment(makeComment({ url: "/a", isSpam: true }, 2));
        const multi = await db.addComment(makeComment({ url: "/b", isSpam: false }, 3));
        const visible = await db.getComments({ url: ["/a", "/b"], isSpam: false });
        expect(visible.map((c) => c._id).sort()).toEqual([keep._id, multi._id].sort());
        expect(await db.countComments({ isSpam: true })).toBe(1);
      } finally {
        await fixture.dispose(db);
      }
    });

    it("排序：created 升/降序与多键排序（popular 形态）", async () => {
      const db = await fixture.create();
      try {
        const ids = [];
        for (let i = 0; i < 5; i++) {
          const doc = await db.addComment(makeComment({ created: 1000 + i, ups: 5 - i }, i));
          ids.push(doc._id);
        }
        const newestFirst = await db.getComments({}, { sort: { created: -1 } });
        expect(newestFirst.map((c) => c.created)).toEqual([1004, 1003, 1002, 1001, 1000]);
        const oldestFirst = await db.getComments({}, { sort: { created: 1 } });
        expect(oldestFirst[0].created).toBe(1000);
        // popular：ups 降序
        const popular = await db.getComments({}, { sort: { ups: -1 } });
        expect(popular.map((c) => c.ups)).toEqual([5, 4, 3, 2, 1]);
      } finally {
        await fixture.dispose(db);
      }
    });

    it("分页：limit + skip 与「多读 1 条」判断 more 的组合（1.x 流式分页）", async () => {
      const db = await fixture.create();
      try {
        for (let i = 0; i < 5; i++) {
          await db.addComment(makeComment({ created: 1000 + i }, i));
        }
        const page1 = await db.getComments({}, { sort: { created: -1 }, skip: 0, limit: 2 });
        expect(page1.map((c) => c.created)).toEqual([1004, 1003]);
        const page2 = await db.getComments({}, { sort: { created: -1 }, skip: 2, limit: 2 });
        expect(page2.map((c) => c.created)).toEqual([1002, 1001]);
        // 流式分页判 more：limit+1 读到 4 条 > limit 3 → 还有更多
        const probe = await db.getComments({}, { sort: { created: -1 }, skip: 3, limit: 2 });
        expect(probe).toHaveLength(2);
        const tail = await db.getComments({}, { sort: { created: -1 }, skip: 4, limit: 2 });
        expect(tail).toHaveLength(1);
      } finally {
        await fixture.dispose(db);
      }
    });

    it("批量导入：缺失 _id 自动补齐、已有 _id 保留", async () => {
      const db = await fixture.create();
      try {
        await db.bulkAddComments([
          makeComment({ nick: "无id" }, 1),
          makeComment({ _id: "fixed-id-123", nick: "带id" }, 2),
        ]);
        const all = await db.getAllComments();
        expect(all).toHaveLength(2);
        const kept = await db.getComment("fixed-id-123");
        expect(kept?.nick).toBe("带id");
        expect(all.every((c) => typeof c._id === "string" && c._id.length > 0)).toBe(true);
      } finally {
        await fixture.dispose(db);
      }
    });

    it("计数器：首读 null → 自增创建（time=1）→ 再自增（time=2）→ title 写入", async () => {
      const db = await fixture.create();
      try {
        expect(await db.getCounter("/post/1")).toBeNull();
        const first = await db.incCounter("/post/1", "第一篇文章");
        expect(first.time).toBe(1);
        expect(first.title).toBe("第一篇文章");
        const second = await db.incCounter("/post/1");
        expect(second.time).toBe(2);
        expect((await db.getCounter("/post/1"))?.time).toBe(2);
      } finally {
        await fixture.dispose(db);
      }
    });

    it("配置：未初始化 null → 保存 → 读取往返；全量保存为真替换（旧键移除）", async () => {
      const db = await fixture.create();
      try {
        expect(await db.getConfig()).toBeNull();
        await db.saveConfig({ ADMIN_PASS: "hash1", SITE_NAME: "twikoo" });
        expect(await db.getConfig()).toEqual({ ADMIN_PASS: "hash1", SITE_NAME: "twikoo" });
        await db.saveConfig({ ADMIN_PASS: "hash2", SITE_NAME: "twikoo", MAIL_SUBJECT: "新评论" });
        expect(await db.getConfig()).toEqual({
          ADMIN_PASS: "hash2",
          SITE_NAME: "twikoo",
          MAIL_SUBJECT: "新评论",
        });
        // 真替换：不含旧键的保存会移除旧键（两实现语义一致，T18 setConfig 负责先合并）
        await db.saveConfig({ ONLY_KEY: "x" });
        expect(await db.getConfig()).toEqual({ ONLY_KEY: "x" });
      } finally {
        await fixture.dispose(db);
      }
    });

    it("验证码 KV：写入→读取→覆盖→删除→读取 null", async () => {
      const db = await fixture.create();
      try {
        expect(await db.capGet("challenge-1")).toBeNull();
        await db.capSet("challenge-1", { challenge: "abc", expires: 123 });
        expect(await db.capGet("challenge-1")).toEqual({ challenge: "abc", expires: 123 });
        await db.capSet("challenge-1", "overwritten");
        expect(await db.capGet("challenge-1")).toBe("overwritten");
        await db.capDel("challenge-1");
        expect(await db.capGet("challenge-1")).toBeNull();
      } finally {
        await fixture.dispose(db);
      }
    });
  });
}

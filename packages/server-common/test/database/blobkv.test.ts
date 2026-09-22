/**
 * BlobKvDatabase 测试。
 *
 * 以内存 fake 模拟 @edgeone/pages-blob 的 store 句柄（setJSON 做 JSON
 * 序列化往返，模拟真实 KV 持久化丢 undefined 的形态）。重点验收：
 * 与 Mongo/Loki 同一套语义断言；缺失 key 返回空而非抛错；
 * comments:all 进程内缓存与 KV 的一致性。
 */
import { describe, expect, it } from "vitest";
import { BlobKvDatabase } from "../../src/database/blobkv";
import type { BlobKvStoreLike } from "../../src/database/blobkv";
import { runDatabaseSemanticSuite } from "./semantic-suite";

/** 内存 Blob KV fake（JSON 往返模拟持久化形态） */
class MemoryBlobStore implements BlobKvStoreLike {
  /** 键值表 */
  private map = new Map<string, string>();

  /** get 调用计数（缓存行为断言用） */
  getCalls = 0;

  /** 读取（缺失返回 null） */
  async get(key: string): Promise<unknown> {
    this.getCalls += 1;
    return this.map.has(key) ? JSON.parse(this.map.get(key) as string) : null;
  }

  /** 写入（JSON 序列化，丢 undefined 字段） */
  async setJSON(key: string, value: unknown): Promise<void> {
    this.map.set(key, JSON.stringify(value));
  }

  /** 删除 */
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  /** 按键前缀列举（只返回键名，与平台 store.list 的返回面一致） */
  async list(options?: { prefix?: string }): Promise<{ blobs: Array<{ key: string }> }> {
    const prefix = options?.prefix ?? "";
    const blobs = [...this.map.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => ({ key }));
    return { blobs };
  }
}

/** 语义套件接入（与 Mongo/Loki 同一套断言）*/
runDatabaseSemanticSuite("BlobKvDatabase", {
  /** 每个用例独立 store */
  create: async () => new BlobKvDatabase(new MemoryBlobStore()),
  /** 空操作（fake 无需关闭） */
  dispose: async () => {},
});

describe("BlobKvDatabase 平台语义", () => {
  it("缺失 key 返回空而非抛错（getAllComments/config/counter/cap，1.7.24 行为）", async () => {
    const db = new BlobKvDatabase(new MemoryBlobStore());
    await expect(db.getAllComments()).resolves.toEqual([]);
    await expect(db.getConfig()).resolves.toBeNull();
    await expect(db.getCounter("/no-such-page")).resolves.toBeNull();
    await expect(db.capGet("no-such-key")).resolves.toBeNull();
  });

  it("comments:all 进程内缓存：读取走缓存；变更强制回源后写回并刷新缓存", async () => {
    const store = new MemoryBlobStore();
    const db = new BlobKvDatabase(store);
    await db.getAllComments();
    const firstReads = store.getCalls;
    await db.getAllComments();
    await db.getAllComments();
    // 纯读取命中缓存：不再产生 KV 读
    expect(store.getCalls).toBe(firstReads);
    // 变更**强制回源**（并发安全的前提，见 #1174）：addComment 多出 1 次 KV 读
    await db.addComment({ _id: "cache-1", nick: "缓存" });
    expect(store.getCalls).toBe(firstReads + 1);
    // 写回后的缓存即最新整表：随后读取不再回源
    const readsAfterWrite = store.getCalls;
    expect((await db.getComment("cache-1"))?.nick).toBe("缓存");
    expect(store.getCalls).toBe(readsAfterWrite);
    // 落 KV：全新实例（无缓存）可读回持久化数据
    const db2 = new BlobKvDatabase(store);
    expect((await db2.getComment("cache-1"))?.nick).toBe("缓存");
  });

  it("排序/分页在 JS 层生效（端口 QueryOptions 补齐 1.x 缺口）", async () => {
    const db = new BlobKvDatabase(new MemoryBlobStore());
    for (let i = 0; i < 5; i++) {
      await db.addComment({ _id: `s-${i}`, nick: `n${i}`, created: 1000 + i });
    }
    const page = await db.getComments({}, { sort: { created: -1 }, skip: 1, limit: 2 });
    expect(page.map((c) => c.created)).toEqual([1003, 1002]);
  });

  it("并发写不丢评论：变更前回源，后写者包含先写者的新增（#1174）", async () => {
    const store = new MemoryBlobStore();
    // 两个实例模拟「两个并发请求各自的 serverless 实例」（EO 为一请求一实例）
    const reqA = new BlobKvDatabase(store);
    const reqB = new BlobKvDatabase(store);

    await reqA.addComment({ _id: "a-1", nick: "A" });
    // B 在本请求早期读过一次 → 陈旧快照进了 B 的进程内缓存（改前的踩雷路径）
    await reqB.getAllComments();
    await reqA.addComment({ _id: "a-2", nick: "A2" });
    await reqB.addComment({ _id: "b-1", nick: "B" });

    const final = await new BlobKvDatabase(store).getAllComments();
    // 改前 B 会把陈旧快照整表写回，a-2 丢失
    expect(final.map((c) => c._id).sort()).toEqual(["a-1", "a-2", "b-1"]);
  });

  it("并发写不复活已删评论：后写者回源后不会把删除前的快照写回（#1174）", async () => {
    const store = new MemoryBlobStore();
    const reqA = new BlobKvDatabase(store);
    const reqB = new BlobKvDatabase(store);

    await reqA.addComment({ _id: "x-1", nick: "X" });
    // B 缓存了「删除前」的快照
    await reqB.getAllComments();
    await reqA.deleteComment("x-1");
    await reqB.addComment({ _id: "y-1", nick: "Y" });

    const final = await new BlobKvDatabase(store).getAllComments();
    // 改前 B 会把 x-1 一起写回，已删评论复活
    expect(final.map((c) => c._id)).toEqual(["y-1"]);
  });
});

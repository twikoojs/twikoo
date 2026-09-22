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
  it("capDeleteExpired：按 cap: 前缀枚举后只删过期记录（#1174）", async () => {
    const db = new BlobKvDatabase(new MemoryBlobStore());
    const now = Date.now();
    await db.capSet("cap:c:expired", { challenge: "x", expires: now - 1 });
    await db.capSet("cap:c:alive", { challenge: "y", expires: now + 60000 });
    await db.capSet("cap:t:alive", { expires: now + 60000 });
    // 非 cap 键不得被误删（前缀枚举的边界）
    await db.capSet("counter:/p", { url: "/p", time: 3 });

    expect(await db.capDeleteExpired(now)).toBe(1);
    expect(await db.capGet("cap:c:expired")).toBeNull();
    expect(await db.capGet("cap:c:alive")).toEqual({ challenge: "y", expires: now + 60000 });
    expect(await db.capGet("counter:/p")).toEqual({ url: "/p", time: 3 });
  });

  it("缺失 key 返回空而非抛错（getAllComments/config/counter/cap，1.7.24 行为）", async () => {
    const db = new BlobKvDatabase(new MemoryBlobStore());
    await expect(db.getAllComments()).resolves.toEqual([]);
    await expect(db.getConfig()).resolves.toBeNull();
    await expect(db.getCounter("/no-such-page")).resolves.toBeNull();
    await expect(db.capGet("no-such-key")).resolves.toBeNull();
  });

  it("comments:all 进程内缓存：首个请求读 KV，后续请求走缓存；写入同步缓存", async () => {
    const store = new MemoryBlobStore();
    const db = new BlobKvDatabase(store);
    await db.getAllComments();
    const firstReads = store.getCalls;
    await db.getAllComments();
    await db.getAllComments();
    // 缓存命中：不再产生 KV 读
    expect(store.getCalls).toBe(firstReads);
    // 写入后缓存同步（getComment 立即可见，不重读 KV）
    await db.addComment({ _id: "cache-1", nick: "缓存" });
    expect(store.getCalls).toBe(firstReads);
    expect((await db.getComment("cache-1"))?.nick).toBe("缓存");
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
});

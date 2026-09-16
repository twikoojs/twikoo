/**
 * CloudBaseDatabase 测试（T16）。
 *
 * 以结构化 mock 模拟 @cloudbase/node-sdk 的 database() 句柄（plan T16 验收
 * 方式：mock SDK 单测）。mock 忠实还原 TCB 行为面：
 * - where 条件里的指令对象（_.in / _.inc）在查询/更新时解释执行；
 * - `_.in` 含 null 时命中「字段缺失」（TCB/Mongo 同语义，ABSENT 翻译的根基）；
 * - update 返回 { updated }、add 返回 { id / ids }、get 返回 { data }。
 *
 * 另有「集合名与指令形态」断言：collection() 调用名 ⊆ {comment, config,
 * counter, cap_kv}；ABSENT 条件翻译为 _.in(["", null])（1.7.24 形态一致）。
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CloudBaseDatabase } from "../../src/database/cloudbase";
import type {
  CloudBaseCollectionLike,
  CloudBaseDatabaseLike,
  CloudBaseQueryLike,
} from "../../src/database/cloudbase";
import { ABSENT } from "../../src/ports/database";
import { runDatabaseSemanticSuite } from "./semantic-suite";

/** mock 指令对象形态 */
interface MockCommand {
  __op: "in" | "inc";
  list?: unknown[];
  n?: number;
}

/** 判定值是否为 mock 指令 */
function isCommand(v: unknown): v is MockCommand {
  return typeof v === "object" && v !== null && "__op" in v;
}

/** 32 位 hex 主键（mock SDK 生成，与语义套件的 uuid 形态断言对齐） */
function mockId(): string {
  return randomUUID().replace(/-/g, "");
}

/** mock 集合：内存文档 + TCB 行为面 */
class MockTcbCollection implements CloudBaseCollectionLike {
  /** 文档表 */
  docs: Record<string, unknown>[] = [];

  /** where 条件捕获记录（形态断言用） */
  readonly capturedConditions: Record<string, unknown>[] = [];

  /**
   * 解释 where 条件为 JS 谓词（指令对象就地求值）
   */
  private matches(doc: Record<string, unknown>, cond: Record<string, unknown>): boolean {
    return Object.entries(cond).every(([key, expected]) => {
      const actual = doc[key];
      if (isCommand(expected) && expected.__op === "in") {
        const list = expected.list ?? [];
        // TCB 语义：null 在列表中命中「字段缺失」
        return list.includes(actual) || (list.includes(null) && actual === undefined);
      }
      return actual === expected;
    });
  }

  /** 条件查询 */
  where(cond: Record<string, unknown>): CloudBaseQueryLike {
    this.capturedConditions.push({ ...cond });
    /**
     * 就地求值当前条件下的匹配文档（get/count/update 共用）
     * @returns 匹配文档数组
     */
    const evaluate = (): Record<string, unknown>[] =>
      this.docs.filter((doc) => this.matches(doc, cond));
    /** 查询链状态 */
    const state: { order?: [string, "asc" | "desc"]; skip?: number; limit?: number } = {};
    const chain: CloudBaseQueryLike = {
      /** 读取匹配文档（排序/分页后） */
      get: async () => {
        let data = evaluate();
        if (state.order) {
          const [field, direction] = state.order;
          data = [...data].sort((a, b) => {
            const av = (a[field] as number) ?? 0;
            const bv = (b[field] as number) ?? 0;
            return direction === "desc" ? bv - av : av - bv;
          });
        }
        if (state.skip !== undefined) data = data.slice(state.skip);
        if (state.limit !== undefined) data = data.slice(0, state.limit);
        return { data };
      },
      /** 匹配计数 */
      count: async () => ({ total: evaluate().length }),
      /** 排序（记录到链状态） */
      orderBy: (field, direction) => {
        state.order = [field, direction];
        return chain;
      },
      /** 跳过条数 */
      skip: (n) => {
        state.skip = n;
        return chain;
      },
      /** 限制条数 */
      limit: (n) => {
        state.limit = n;
        return chain;
      },
      /** 批量更新（inc 指令就地求值） */
      update: async (payload) => {
        let updated = 0;
        for (const doc of this.docs) {
          if (!this.matches(doc, cond)) continue;
          for (const [key, value] of Object.entries(payload)) {
            if (isCommand(value) && value.__op === "inc") {
              doc[key] = ((doc[key] as number) ?? 0) + (value.n ?? 0);
            } else {
              doc[key] = value;
            }
          }
          updated += 1;
        }
        return { updated };
      },
      /** 批量删除匹配文档 */
      remove: async () => {
        const before = this.docs.length;
        this.docs = this.docs.filter((doc) => !this.matches(doc, cond));
        return { deleted: before - this.docs.length };
      },
    };
    return chain;
  }

  /** 新增（TCB 语义：尊重显式 _id——1.x 导入依赖此行为；缺失时 SDK 生成） */
  async add(data: object | object[]): Promise<{ id?: string; ids?: string[] }> {
    if (Array.isArray(data)) {
      const ids = data.map((item) => {
        const id =
          typeof (item as { _id?: string })._id === "string"
            ? (item as { _id: string })._id
            : mockId();
        this.docs.push({ ...item, _id: id });
        return id;
      });
      return { ids };
    }
    const provided = (data as { _id?: string })._id;
    const id = typeof provided === "string" ? provided : mockId();
    this.docs.push({ ...data, _id: id });
    return { id };
  }

  /** 按文档 id 取句柄 */
  doc(id: string) {
    return {
      /** 读取单文档 */
      get: async () => {
        const doc = this.docs.find((d) => d._id === id);
        return { data: doc ? { ...doc } : undefined };
      },
      /** 更新单文档 */
      update: async (payload: object) => {
        const doc = this.docs.find((d) => d._id === id);
        if (!doc) return {};
        Object.assign(doc, payload);
        return { updated: 1 };
      },
      /** 删除单文档 */
      delete: async () => {
        const before = this.docs.length;
        this.docs = this.docs.filter((d) => d._id !== id);
        return { deleted: before - this.docs.length };
      },
    };
  }
}

/** mock TCB 数据库句柄（记录全部集合名访问） */
class MockTcbDatabase implements CloudBaseDatabaseLike {
  /** 查询指令（记录指令构造供形态断言） */
  readonly command = {
    /** _.in 指令 */
    in: (list: unknown[]): MockCommand => ({ __op: "in", list }),
    /** _.inc 指令 */
    inc: (n: number): MockCommand => ({ __op: "inc", n }),
  };

  /** 已创建集合（name → 实例） */
  readonly collections = new Map<string, MockTcbCollection>();

  /** 全部 collection() 调用名（集合名一致性断言用） */
  readonly accessedCollections: string[] = [];

  /**
   * 取集合（不存在则创建）
   * @param name 集合名
   * @returns 集合实例
   */
  collection(name: string): MockTcbCollection {
    this.accessedCollections.push(name);
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new MockTcbCollection();
      this.collections.set(name, collection);
    }
    return collection;
  }
}

/** 语义套件接入（与 Mongo/Loki/BlobKV 同一套断言，R-3） */
runDatabaseSemanticSuite("CloudBaseDatabase", {
  /** 每个用例独立 mock 数据库 */
  create: async () => new CloudBaseDatabase({ database: new MockTcbDatabase() }),
  /** 空操作（mock 无需关闭） */
  dispose: async () => {},
});

describe("CloudBaseDatabase 平台语义（T16）", () => {
  it("集合名与 1.7.24 一致：全部 collection() 调用 ∈ {comment, config, counter, cap_kv}", async () => {
    const mock = new MockTcbDatabase();
    const db = new CloudBaseDatabase({ database: mock });
    await db.addComment({ _id: "a", nick: "x" });
    await db.getComments({ rid: "a" });
    await db.countComments({});
    await db.saveConfig({ SITE_NAME: "twikoo" });
    await db.getConfig();
    await db.incCounter("/p/1");
    await db.getCounter("/p/1");
    await db.capSet("k", "v");
    await db.capGet("k");
    await db.capDel("k");
    await db.updateComment("a", { nick: "y" });
    await db.deleteComment("a");
    const used = new Set(mock.accessedCollections);
    for (const name of used) {
      expect(["comment", "config", "counter", "cap_kv"]).toContain(name);
    }
  });

  it("ABSENT 翻译为 _.in(['', null])（1.x L288 指令形态逐字对齐）", async () => {
    const mock = new MockTcbDatabase();
    const db = new CloudBaseDatabase({ database: mock });
    await db.getComments({ rid: ABSENT });
    const comment = mock.collections.get("comment");
    const captured = comment?.capturedConditions.at(-1);
    const rid = captured?.rid as { __op: string; list?: unknown[] };
    expect(rid.__op).toBe("in");
    expect(rid.list).toEqual(["", null]);
  });

  it("incCounter 使用 _.inc(1) 指令（1.x counter 字段形态）", async () => {
    const mock = new MockTcbDatabase();
    const db = new CloudBaseDatabase({ database: mock });
    await db.incCounter("/p/1", "标题");
    await db.incCounter("/p/1");
    const counter = mock.collections.get("counter");
    expect(counter?.docs).toHaveLength(1);
    expect(counter?.docs[0].time).toBe(2);
    expect(counter?.docs[0].title).toBe("标题");
  });
});

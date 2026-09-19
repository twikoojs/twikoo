/**
 * MongoDatabase 测试。
 *
 * 默认用 mongodb-memory-server 提供的临时实例（无需用户
 * 填充 TEST_MONGODB_URI）；设置了 TEST_MONGODB_URI 时改连真实实例。
 * 场景（实例停机 → 连接失败错误可读）单列 describe。
 *
 * 内存实例在本机起不来时（如 macOS arm64 未装 Rosetta）**整组跳过**，
 * 判定与理由见 `test/utils/mongo-availability.ts`。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoDatabase } from "../../src/database/mongo";
import type { Database } from "../../src/ports/database";
import { mongoMemoryServerUnavailableReason } from "../utils/mongo-availability";
import { runDatabaseSemanticSuite } from "./semantic-suite";

/** 本机跑不了内存 mongod 的原因；可运行时为 null */
const unavailable = mongoMemoryServerUnavailableReason();

/** 复用进程级单例：多 describe 共享，避免重复启动内存实例 */
let mongod: MongoMemoryServer | null = null;

/** 测试库连接串（外部真实实例优先，默认内存实例） */
let uri = "";

if (unavailable !== null) {
  // 跳过而非失败：环境能力问题（详见 utils/mongo-availability.ts 的模块注释）
  describe.skip(`MongoDatabase（跳过：${unavailable}）`, () => {
    it("本机无法运行 mongodb-memory-server，整组跳过", () => {
      expect(unavailable).not.toBeNull();
    });
  });
} else {
  beforeAll(async () => {
    // 固定服务端版本 4.4.29（driver 6.x 官方支持矩阵内最小版）：Windows 全量 zip
    // 体积随版本显著增大（8.x ≈ 820MB，4.4 ≈ 291MB），且语义套件只使用基础操作；
    // 已设置 MONGOMS_VERSION 时尊重外部配置。
    process.env.MONGOMS_VERSION ??= "4.4.29";
    if (process.env.TEST_MONGODB_URI) {
      uri = process.env.TEST_MONGODB_URI;
      return;
    }
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri("twikoo_test");
  });

  afterAll(async () => {
    await mongod?.stop();
  });

  /** 语义套件接入（Loki 跑同一套断言）*/
  runDatabaseSemanticSuite("MongoDatabase", {
    /** 每个用例独立数据库：隔离用例间数据（同一 mongod 实例上多库零成本） */
    create: async () => {
      const dbName = `twikoo_test_${Math.random().toString(36).slice(2, 10)}`;
      const db = new MongoDatabase({ uri, dbName });
      await db.init();
      return db;
    },
    /** 关闭连接（内存实例由 afterAll 统一停机） */
    dispose: async (db: Database) => {
      await db.close?.();
    },
  });

  describe("MongoDatabase 连接语义", () => {
    it("init 幂等：重复调用复用同一连接不报错", async () => {
      const db = new MongoDatabase({ uri });
      await db.init();
      await db.init();
      await db.addComment({ _id: "idempotent-check", nick: "x" });
      expect((await db.getComment("idempotent-check"))?.nick).toBe("x");
      await db.close();
    });

    it("内存实例停机后操作抛可读错误（非静默失败）", async () => {
      if (mongod === null) return; // 外部真实实例不执行本用例（不能停别人的库）
      const db = new MongoDatabase({ uri });
      await db.init();
      await mongod.stop();
      mongod = null;
      // 实例已停：任何读操作都必须显式失败，绝不静默返回空结果
      // （实测错误形态：connect ECONNREFUSED / MongoServerClosedError 等）
      await expect(db.getComments({})).rejects.toThrow(/econnrefused|topology|closed|connection/i);
      await db.close().catch(() => {});
    });
  });
}

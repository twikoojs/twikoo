/**
 * Mongo 实现接入契约套件。
 *
 * 内存实例在本机起不来时（如 macOS arm64 未装 Rosetta）**整组跳过**，
 * 判定与理由见 `test/utils/mongo-availability.ts`。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoDatabase } from "../../src/database/mongo";
import type { Database } from "../../src/ports/database";
import { mongoMemoryServerUnavailableReason } from "../utils/mongo-availability";
import { runContractSuite } from "./contract-suite";

/** 本机跑不了内存 mongod 的原因；可运行时为 null */
const unavailable = mongoMemoryServerUnavailableReason();

let mongod: MongoMemoryServer | null = null;
let uri = "";

if (unavailable !== null) {
  // 跳过而非失败：环境能力问题（详见 utils/mongo-availability.ts 的模块注释）
  describe.skip(`MongoDatabase 契约套件（跳过：${unavailable}）`, () => {
    it("本机无法运行 mongodb-memory-server，整组跳过", () => {
      expect(unavailable).not.toBeNull();
    });
  });
} else {
  beforeAll(async () => {
    process.env.MONGOMS_VERSION ??= "4.4.29";
    if (process.env.TEST_MONGODB_URI) {
      uri = process.env.TEST_MONGODB_URI;
      return;
    }
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri("twikoo_contract");
  });

  afterAll(async () => {
    await mongod?.stop();
  });

  runContractSuite("MongoDatabase", {
    /** 每用例独立数据库（同一 mongod 多库隔离） */
    createDb: async () => {
      const dbName = `twikoo_contract_${Math.random().toString(36).slice(2, 10)}`;
      const db = new MongoDatabase({ uri, dbName });
      await db.init();
      return db;
    },
    /** 关闭连接（内存实例由 afterAll 停机） */
    disposeDb: async (db: Database) => {
      await db.close?.();
    },
  });
}

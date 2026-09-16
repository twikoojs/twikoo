/**
 * Mongo 实现接入契约套件（T19）。
 */
import { afterAll, beforeAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoDatabase } from "../../src/database/mongo";
import type { Database } from "../../src/ports/database";
import { runContractSuite } from "./contract-suite";

let mongod: MongoMemoryServer | null = null;
let uri = "";

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

/**
 * Loki 实现接入契约套件（T19；LSFA 持久化落盘 close 时执行）。
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { LokiDatabase } from "../../src/database/loki";
import type { Database } from "../../src/ports/database";
import { runContractSuite } from "./contract-suite";

/** 每用例独立临时目录 */
let workDir = "";

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "twikoo-contract-loki-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

runContractSuite("LokiDatabase", {
  /** 每用例独立数据目录（临时目录内随机子目录） */
  createDb: async () => {
    const dir = join(workDir, `data-${Math.random().toString(36).slice(2, 8)}`);
    const db = new LokiDatabase({ dataDir: dir });
    await db.init();
    return db;
  },
  /** 落盘并关闭（临时目录由 afterEach 清理） */
  disposeDb: async (db: Database) => {
    await db.close?.();
  },
});

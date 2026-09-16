/**
 * LokiDatabase 测试（T15）。
 *
 * 使用临时目录承载 db.json（§9.4 B 类默认值：TWIKOO_DATA 走临时目录，无需
 * 用户填充）。重点验收：与 Mongo 同一套语义断言全绿（R-3 跨库一致性）、
 * LSFA 持久化往返、数据目录不可写时明确报错且不产生半写文件（QA−）。
 */
import { mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LokiDatabase } from "../../src/database/loki";
import type { Database } from "../../src/ports/database";
import { runDatabaseSemanticSuite } from "./semantic-suite";

/** 每个用例独立的临时目录（afterEach 统一清理） */
let workDir = "";

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "twikoo-loki-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** 语义套件接入（与 Mongo 同一套断言，R-3） */
runDatabaseSemanticSuite("LokiDatabase", {
  /** 每个用例独立数据目录（临时目录内随机子目录，互不串扰） */
  create: async () => {
    const dir = join(workDir, `data-${Math.random().toString(36).slice(2, 8)}`);
    const db = new LokiDatabase({ dataDir: dir });
    await db.init();
    return db;
  },
  /** 落盘并关闭（临时目录由 afterEach 统一清理） */
  dispose: async (db: Database) => {
    await db.close?.();
  },
});

describe("LokiDatabase 持久化与容错（T15）", () => {
  it("LSFA 持久化往返：写入 → close 落盘 → 重新 autoload 数据完好", async () => {
    const dir = join(workDir, "persist");
    const db = new LokiDatabase({ dataDir: dir });
    await db.init();
    await db.addComment({ _id: "persist-1", nick: "落盘者", url: "/p/1" });
    await db.saveConfig({ SITE_NAME: "持久化站点" });
    await db.incCounter("/p/1", "持久化页");
    await db.close();
    expect(existsSync(join(dir, "db.json"))).toBe(true);

    // 全新实例重新加载
    const db2 = new LokiDatabase({ dataDir: dir });
    await db2.init();
    expect((await db2.getComment("persist-1"))?.nick).toBe("落盘者");
    expect(await db2.getConfig()).toEqual({ SITE_NAME: "持久化站点" });
    expect((await db2.getCounter("/p/1"))?.time).toBe(1);
    // 持久化后 ABSENT 语义依旧（JSON 序列化后 rid 缺失形态保持）
    await db2.addComment({ _id: "persist-2", nick: "回复", url: "/p/1", rid: "persist-1" });
    const tops = await db2.getComments({ rid: "persist-1" });
    expect(tops).toHaveLength(1);
    await db2.close();
  });

  it("close 幂等：未 init / 重复 close 不抛错", async () => {
    const db = new LokiDatabase({ dataDir: join(workDir, "close-idempotent") });
    await expect(db.close()).resolves.toBeUndefined();
    await db.init();
    await db.close();
    await expect(db.close()).resolves.toBeUndefined();
  });

  it("QA−：数据目录不可创建（父级为文件）→ init 抛可读错误且不产生半写 db.json", async () => {
    // 制造不可写场景：把「数据目录的父级」换成普通文件（mkdir 必然 ENOTDIR/EEXIST）
    const notADir = join(workDir, "not-a-dir");
    writeFileSync(notADir, "blocker");
    const dataDir = join(notADir, "data");
    const db = new LokiDatabase({ dataDir });
    // 明确失败（非静默）：错误来自 mkdirSync，含系统错误码，可读可诊断
    await expect(db.init()).rejects.toThrow(/ENOTDIR|EEXIST|not a directory/i);
    // 不产生半写文件
    expect(existsSync(join(dataDir, "db.json"))).toBe(false);
  });

  it("init 幂等：重复调用复用同一实例且数据可继续写入", async () => {
    const db = new LokiDatabase({ dataDir: join(workDir, "init-idempotent") });
    await db.init();
    await db.init();
    await db.addComment({ _id: "idem-1", nick: "x" });
    expect((await db.getComment("idem-1"))?.nick).toBe("x");
    await db.close();
  });
});

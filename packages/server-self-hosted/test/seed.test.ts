/**
 * 验收用例：demo 数据 seed。
 *
 * 触发三态各一例（不存在→生成 / 存在但空→补 / 有数据→零改动）+ 11 场景逐项覆盖；
 * 未开启 `TWIKOO_SEED` 误触达 → 抛错且不写任何数据（生产不可触达）。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LokiDatabase, type CommentDoc } from "@twikoojs/common";
import { describe, expect, it } from "vitest";
import {
  DEMO_CONFIG,
  DEMO_SCENARIOS,
  DEMO_URL,
  DEMO_VISITORS,
  OTHER_URL,
} from "../src/seed/fixtures";
import { SEED_ENV_KEY, SeedNotAllowedError, isSeedEnabled, seedDemoData } from "../src/seed";

/** 允许为空的配置字段（空值即其语义默认：无背景图 / 无推送渠道 / 未启用验证码 / 未配置外部 endpoint） */
const ALLOW_EMPTY_CONFIG = new Set([
  "COMMENT_BG_IMG",
  "PUSHOO_TOKEN",
  "CAP_API_ENDPOINT",
  "CAPTCHA_PROVIDER",
]);

/** 开启 seed 的环境变量表 */
const ENABLED_ENV = { [SEED_ENV_KEY]: "1" };

/** 忽略日志的输出器（多数用例只关心数据结果，不关心日志文本） */
const noopLog = (): void => {};

/** 创建临时数据目录下的 Loki 实例 */
function makeDatabase(dir: string): LokiDatabase {
  return new LokiDatabase({ dataDir: join(dir, "data") });
}

/** 收集日志的写入器 */
function collector(): { lines: string[]; log: (m: string) => void } {
  const lines: string[] = [];
  return {
    lines,
    /** 收集一行日志 */
    log: (m: string) => {
      lines.push(m);
    },
  };
}

describe("seed 触发三态", () => {
  it("态 1：数据库文件不存在 → 自动生成并打印「已生成 N 条测试评论」", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-seed-new-"));
    const database = makeDatabase(dir);
    expect(existsSync(join(dir, "data", "db.json"))).toBe(false);

    const sink = collector();
    const result = await seedDemoData({ database, env: ENABLED_ENV, log: sink.log });

    expect(result.seeded).toBe(true);
    expect(result.comments).toBeGreaterThan(0);
    expect(sink.lines.join("\n")).toContain(`已生成 ${result.comments} 条测试评论`);
    expect(await database.countComments({})).toBe(result.comments);
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("态 2：文件存在但为空（目录已建、无评论）→ 补数据", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-seed-empty-"));
    const database = makeDatabase(dir);
    await database.init();
    expect(await database.countComments({})).toBe(0);
    await database.close();

    const sink = collector();
    const result = await seedDemoData({ database, env: ENABLED_ENV, log: sink.log });
    expect(result.seeded).toBe(true);
    expect(await database.countComments({})).toBe(result.comments);
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("态 3：已有数据 → 零改动（内容不变 + db.json mtime 不变）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-seed-keep-"));
    const database = makeDatabase(dir);
    const first = await seedDemoData({ database, env: ENABLED_ENV, log: noopLog });
    /** 关库前取内容快照（close 会卸载 Loki 实例） */
    const commentsBefore = await database.getAllComments();
    await database.close();

    const dbFile = join(dir, "data", "db.json");
    const bytesBefore = readFileSync(dbFile);
    const mtimeBefore = statSync(dbFile).mtimeMs;

    const sink = collector();
    /** 第二次调用会重新 init 并命中「已有数据」分支 */
    const second = await seedDemoData({ database, env: ENABLED_ENV, log: sink.log });

    expect(second.seeded).toBe(false);
    expect(second.comments).toBe(first.comments);
    expect(sink.lines.join("\n")).toContain("跳过 seed");
    expect(readFileSync(dbFile).equals(bytesBefore)).toBe(true);
    expect(statSync(dbFile).mtimeMs).toBe(mtimeBefore);
    expect(await database.getAllComments()).toEqual(commentsBefore);
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("态 3（新实例复读）：已有数据时第二个进程同样不改动", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-seed-keep2-"));
    const seedDb = makeDatabase(dir);
    const first = await seedDemoData({ database: seedDb, env: ENABLED_ENV, log: noopLog });
    await seedDb.close();

    const freshDb = makeDatabase(dir);
    const result = await seedDemoData({ database: freshDb, env: ENABLED_ENV, log: noopLog });
    expect(result.seeded).toBe(false);
    expect(result.comments).toBe(first.comments);
    expect(await freshDb.countComments({})).toBe(first.comments);
    await freshDb.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("十一项场景覆盖（覆盖表）", () => {
  it("场景 1–9 + 10 + 11 逐项可断言", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-seed-scene-"));
    const database = makeDatabase(dir);
    await seedDemoData({ database, env: ENABLED_ENV, log: noopLog });

    const page = await database.getComments({ url: DEMO_URL });
    /**
     * 按内容片段查找评论。
     * @param needle 内容片段
     * @returns 命中的评论（未命中为 undefined）
     */
    const byComment = (needle: string): CommentDoc | undefined =>
      page.find((c) => (c.comment ?? "").includes(needle));

    // 场景 1：普通评论含 _id/url/nick/mail/link/ua/ip
    const master = page.find((c) => c.master === true);
    expect(master).toBeTruthy();
    for (const field of ["_id", "url", "nick", "mail", "link", "ua", "ip"] as const) {
      expect(master?.[field], `场景 1：缺少字段 ${field}`).toBeTruthy();
    }
    expect(page.length).toBeGreaterThan(1);

    // 场景 2：嵌套回复（多层 pid/rid —— 3 层）
    const reply1 = byComment("多层回复怎么展示");
    const reply2 = byComment("pid 指直接上级");
    const reply3 = byComment("第三层也能正常显示");
    expect(reply1?.pid).toBe(master?._id);
    expect(reply2?.pid).toBe(reply1?._id);
    expect(reply3?.pid).toBe(reply2?._id);
    expect(reply2?.rid).toBe(master?._id);
    expect(reply3?.rid).toBe(master?._id);

    // 场景 3：owo 表情
    expect(byComment(":QQ:")).toBeTruthy();
    // 场景 4：公式（行内 $…$ + 块级 $$…$$）
    const formula = byComment("$$\\int_{0}^{1}");
    expect(formula?.comment).toContain("$E = mc^2$");
    // 场景 5：代码块（language-js，供 Prism 高亮）
    expect(byComment("language-js")).toBeTruthy();
    // 场景 6：链接 + 图片
    const rich = byComment("twikoo.js.org");
    expect(rich?.comment).toContain('<img src="data:image/svg+xml');
    // 场景 7：已点赞（like 字段有值）
    expect((master?.like ?? []).length).toBeGreaterThan(0);
    // 场景 8：垃圾评论
    expect(page.some((c) => c.isSpam === true)).toBe(true);

    // 场景 9：多个 url 路径的评论（分页时互不串页）
    const other = await database.getComments({ url: OTHER_URL });
    expect(other.length).toBe(3);
    expect(other.every((c) => c.url === OTHER_URL)).toBe(true);

    // 场景 10：访客计数
    const counter = await database.getCounter(DEMO_URL);
    expect(counter?.time).toBe(DEMO_VISITORS);
    expect(counter?.title).toBe("Twikoo Demo");

    // 场景 11：默认配置对象（配置面板全部字段有值）
    const config = await database.getConfig();
    expect(config).toBeTruthy();
    const keys = Object.keys(config ?? {});
    expect(keys.length).toBeGreaterThanOrEqual(70);
    /** 写库配置必须覆盖 fixtures 声明的全部键（防止「面板缺字段」） */
    for (const key of Object.keys(DEMO_CONFIG)) {
      expect(keys, `配置缺少字段 ${key}`).toContain(key);
    }
    const emptyKeys = keys.filter((k) => {
      const value = (config ?? {})[k];
      return value === undefined || value === null || String(value) === "";
    });
    expect(emptyKeys.filter((k) => !ALLOW_EMPTY_CONFIG.has(k))).toEqual([]);

    await database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("场景清单与 fixtures 声明一致（11 项，防止「表里写了但没造」）", () => {
    expect(DEMO_SCENARIOS.length).toBe(11);
    expect(DEMO_URL).toBe("/demo.html");
  });
});

describe("生产不可触达（未开启 TWIKOO_SEED）", () => {
  it("误触达 → 抛 SeedNotAllowedError，且不写任何数据（连数据目录都不创建）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tkserver-seed-guard-"));
    const database = makeDatabase(dir);
    await expect(seedDemoData({ database, env: {}, log: noopLog })).rejects.toBeInstanceOf(
      SeedNotAllowedError,
    );
    expect(existsSync(join(dir, "data"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("开关判定：仅 TWIKOO_SEED=1 为开启", () => {
    expect(isSeedEnabled({})).toBe(false);
    expect(isSeedEnabled({ [SEED_ENV_KEY]: "0" })).toBe(false);
    expect(isSeedEnabled({ [SEED_ENV_KEY]: "true" })).toBe(false);
    expect(isSeedEnabled({ [SEED_ENV_KEY]: "1" })).toBe(true);
  });

  it("启动路径守卫：seed 仅在 TWIKOO_SEED=1 分支内动态 import（静态断言）", () => {
    const source = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
    expect(source).toContain('process.env.TWIKOO_SEED === "1"');
    expect(source).toMatch(/TWIKOO_SEED === "1"[\s\S]{0,400}await import\("\.\/seed"\)/);
  });
});

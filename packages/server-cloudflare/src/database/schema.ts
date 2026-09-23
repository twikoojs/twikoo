/**
 * D1 表结构与升级语句（唯一真相源）。
 *
 * Workers 里没有可读文件系统，`init()` 只能执行字面量 SQL，故 DDL 内联在这里；
 * 仓库内的 `schema.sql` 是同一份语句的副本，供 `wrangler d1 execute --file` 手工初始化
 * （CI 里不跑 wrangler，故由 `test/database/schema.test.ts` 断言两者语句集合一致）。
 *
 * **表形态与 1.x twikoo-cloudflare 刻意对齐**（这样站长可以直接拿 1.x 的 D1 库升级，
 * 不必迁移数据）：
 * - `comment`：1.x 的 21 列逐列保留（`"like"` 是保留字，全程加双引号）；
 * - `config`：1.x 的单行表 `config(value)`（无主键）——不用 `id = 1` 形状，否则 1.x 库
 *   需要改表才能读写；
 * - `counter`：1.x 形状（url 主键）。
 * 2.0 的两处**增量**：
 * - `comment.extra`：承载 `CommentDoc` 的扩展字段（1.x 直接丢弃，2.0 存 JSON 以免
 *   导入/导出往返丢数据），故 1.x 库需要一条 `ALTER TABLE`（见
 *   {@link MIGRATION_STATEMENTS}）；
 * - `cap_kv`：2.0 内嵌 Cap 验证码的存储（1.x 无此功能）。
 */
import type { D1DatabaseLike } from "./binding";

/**
 * 建表语句（逐条幂等 `IF NOT EXISTS`）。
 *
 * 顺序：表 → 索引。`comment` 的索引按「页面查询（url, created）」「最新评论/分页
 * （created）」「限流（ip, created）」「回复归组（rid）」四条访问路径建立。
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "comment" (
  "_id" TEXT PRIMARY KEY,
  "uid" TEXT NOT NULL DEFAULT '',
  "nick" TEXT NOT NULL DEFAULT '',
  "mail" TEXT NOT NULL DEFAULT '',
  "mailMd5" TEXT NOT NULL DEFAULT '',
  "link" TEXT NOT NULL DEFAULT '',
  "avatar" TEXT NOT NULL DEFAULT '',
  "ua" TEXT NOT NULL DEFAULT '',
  "ip" TEXT NOT NULL DEFAULT '',
  "ipRegion" TEXT NOT NULL DEFAULT '',
  "master" INTEGER NOT NULL DEFAULT 0,
  "url" TEXT NOT NULL DEFAULT '',
  "href" TEXT NOT NULL DEFAULT '',
  "comment" TEXT NOT NULL DEFAULT '',
  "pid" TEXT NOT NULL DEFAULT '',
  "rid" TEXT NOT NULL DEFAULT '',
  "like" TEXT NOT NULL DEFAULT '[]',
  "top" INTEGER NOT NULL DEFAULT 0,
  "isSpam" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "extra" TEXT NOT NULL DEFAULT '{}'
)`,
  `CREATE INDEX IF NOT EXISTS "idx_comment_url_created" ON "comment" ("url", "created" DESC)`,
  `CREATE INDEX IF NOT EXISTS "idx_comment_created" ON "comment" ("created" DESC)`,
  `CREATE INDEX IF NOT EXISTS "idx_comment_ip_created" ON "comment" ("ip", "created" DESC)`,
  `CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "comment" ("rid")`,
  `CREATE TABLE IF NOT EXISTS "counter" (
  "url" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT '',
  "time" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS "config" (
  "value" TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS "cap_kv" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "expires" INTEGER
)`,
  `CREATE INDEX IF NOT EXISTS "idx_cap_kv_expires" ON "cap_kv" ("expires")`,
];

/**
 * 增量升级语句（针对已存在的 1.x 库）。
 *
 * 逐条执行、**失败即忽略**：`ALTER TABLE ... ADD COLUMN` 在列已存在时报错，
 * 而"列已存在"正是新装库与二次运行的常态。这里不做 `PRAGMA table_info` 预探测，
 * 是因为 D1 对 PRAGMA 的支持面随版本变化（探测失败会让整个 init 挂掉，
 * 而忽略 ALTER 失败绝不会）。
 */
export const MIGRATION_STATEMENTS: string[] = [
  `ALTER TABLE "comment" ADD COLUMN "extra" TEXT NOT NULL DEFAULT '{}'`,
];

/** 已完成建表的绑定（同一 isolate 内只需建一次；WeakMap 不阻止绑定被回收） */
let readyBindings = new WeakMap<object, Promise<void>>();

/**
 * 执行建表 + 升级（幂等，同一绑定对象只跑一次；失败不缓存，下次请求重试）。
 * @param db D1 绑定
 */
export function ensureSchema(db: D1DatabaseLike): Promise<void> {
  const cached = readyBindings.get(db);
  if (cached) return cached;
  const running = (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await db.prepare(statement).run();
    }
    for (const statement of MIGRATION_STATEMENTS) {
      try {
        await db.prepare(statement).run();
      } catch {
        // 列已存在（1.x 库已升级 / 新装库本就有该列）：无需处理
      }
    }
  })().catch((e: unknown) => {
    // 建表失败不能留在缓存里，否则整个 isolate 生命周期内都恢复不了
    readyBindings.delete(db);
    throw e;
  });
  readyBindings.set(db, running);
  return running;
}

/**
 * 清空建表缓存（测试复位用：模块级缓存会在用例之间串味）。
 */
export function resetSchemaCache(): void {
  readyBindings = new WeakMap<object, Promise<void>>();
}

-- Twikoo 2.0 Cloudflare D1 表结构
--
-- 用法（首次部署）：
--   npx wrangler d1 create twikoo
--   npx wrangler d1 execute twikoo --remote --file=./schema.sql
--
-- 本文件与 packages/server-cloudflare/src/database/schema.ts 的 SCHEMA_STATEMENTS
-- 同源（Workers 里读不到文件，运行时的 init() 只能执行内联字面量 SQL）；
-- 两者一致性由 packages/server-cloudflare/test/database/schema.test.ts 断言。
-- 若只想让云函数自己建表，跳过本文件也可以（首次请求会执行同一批语句）。

CREATE TABLE IF NOT EXISTS "comment" (
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
);

CREATE INDEX IF NOT EXISTS "idx_comment_url_created" ON "comment" ("url", "created" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_created" ON "comment" ("created" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_ip_created" ON "comment" ("ip", "created" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "comment" ("rid");

CREATE TABLE IF NOT EXISTS "counter" (
  "url" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT '',
  "time" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "config" (
  "value" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "cap_kv" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "expires" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_cap_kv_expires" ON "cap_kv" ("expires");

-- 从 1.x twikoo-cloudflare 的 D1 库升级：comment 表需补一列（列已存在时会报错，可忽略）
-- ALTER TABLE "comment" ADD COLUMN "extra" TEXT NOT NULL DEFAULT '{}';

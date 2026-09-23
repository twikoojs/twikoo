/**
 * 表结构一致性测试：`schema.sql`（给 `wrangler d1 execute --file` 用）必须与
 * 运行时执行的 {@link SCHEMA_STATEMENTS} 完全同源。
 *
 * Workers 里读不到文件，`init()` 只能执行内联字面量 SQL；两份副本一旦漂移，
 * 「手工建库」与「云函数自建库」会得到不同的表结构，且只在真实部署后才暴露。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIGRATION_STATEMENTS, SCHEMA_STATEMENTS } from "../../src/database/schema";

/** 仓库内 schema.sql 的文本 */
const schemaSql = readFileSync(new URL("../../schema.sql", import.meta.url), "utf8");

/**
 * SQL 归一化（去掉空白与引号差异，只比对语句骨架）。
 * @param sql SQL 文本
 * @returns 归一化文本
 */
function normalize(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .replace(/["`]/g, "")
    .replace(/;\s*/g, ";")
    .trim();
}

describe("schema.sql 与运行时的建表语句同源", () => {
  it("SCHEMA_STATEMENTS 的每条语句都出现在 schema.sql 里", () => {
    const normalizedFile = normalize(schemaSql);
    const missing = SCHEMA_STATEMENTS.filter((statement) => !normalizedFile.includes(normalize(statement)));
    expect(missing, `schema.sql 缺少以下语句：\n${missing.join("\n")}`).toEqual([]);
  });

  it("schema.sql 里的可执行语句与 SCHEMA_STATEMENTS 数量一致（防止文件里多出未登记的语句）", () => {
    const executable = schemaSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    expect(executable).toHaveLength(SCHEMA_STATEMENTS.length);
  });

  it("迁移语句在 schema.sql 里以注释形式给出（1.x 升级路径可抄）", () => {
    for (const statement of MIGRATION_STATEMENTS) {
      expect(schemaSql).toContain(statement);
    }
  });
});

/**
 * D1 绑定替身：把 `node:sqlite` 的 `DatabaseSync` 包成 {@link D1DatabaseLike}。
 *
 * **为什么不用手写 JS 假实现**：D1 的语义全在 SQL 里（`ON CONFLICT`、`json_extract`、
 * `LIMIT -1 OFFSET`、NULL 与空串的区分……），JS 替身只能验「形参传对了」，验不了 SQL。
 * Node 26 内置的 `node:sqlite` 与 D1 同为 SQLite，语句行为一致，于是本包的单测可以
 * **真的跑 SQL**（建表、约束、upsert、模糊条件全都真实生效），且不依赖网络与 wrangler。
 *
 * 已知差异（对被测代码无影响）：D1 的 `bind()` 与语句是两段式，内部实现细节不同；
 * `meta.changes` 在两边都来自 SQLite 的 `changes()`。
 */
import { DatabaseSync } from "node:sqlite";
import type { StatementSync } from "node:sqlite";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1ResultLike,
} from "../../src/database/binding";

/** D1 替身（额外暴露 close，便于用例收尾回收内存库） */
export interface SqliteD1 extends D1DatabaseLike {
  /**
   * 关闭数据库
   */
  close(): void;
}

/** 预编译语句替身 */
class SqliteStatement implements D1PreparedStatementLike {
  /** 底层语句 */
  private readonly statement: StatementSync;

  /** 已绑定参数 */
  private readonly params: unknown[];

  /**
   * @param statement node:sqlite 语句
   * @param params 已绑定参数
   */
  constructor(statement: StatementSync, params: unknown[] = []) {
    this.statement = statement;
    this.params = params;
  }

  /**
   * 绑定位置参数
   * @param values 参数值
   * @returns 绑定后的语句（新实例，与 D1 的不可变语义一致）
   */
  bind(...values: unknown[]): D1PreparedStatementLike {
    return new SqliteStatement(this.statement, values);
  }

  /**
   * 取首行
   * @param column 只取该列的值
   * @returns 首行 / 该列的值；无行返回 null
   */
  async first<T = unknown>(column?: string): Promise<T | null> {
    const row = this.statement.get(...(this.params as never[])) as Record<string, unknown> | undefined;
    if (row === undefined) return null;
    return (column ? row[column] : row) as T;
  }

  /**
   * 取全部行
   * @returns 结果集
   */
  async all<T = unknown>(): Promise<D1ResultLike<T>> {
    const results = this.statement.all(...(this.params as never[])) as T[];
    return { results, success: true };
  }

  /**
   * 执行写语句
   * @returns 执行结果（`meta.changes` 为影响行数）
   */
  async run(): Promise<D1ResultLike> {
    const result = this.statement.run(...(this.params as never[]));
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

/**
 * 创建内存 D1 替身（每次调用一个全新的 `:memory:` 库，用例互不干扰）。
 * @param schema 可选的初始化 SQL（用于模拟 1.x 既有库）
 * @returns D1 替身
 */
export function createSqliteD1(schema?: string): SqliteD1 {
  const db = new DatabaseSync(":memory:");
  if (schema) db.exec(schema);
  return {
    /**
     * 预编译语句
     * @param sql SQL 文本
     * @returns 预编译语句
     */
    prepare(sql: string): D1PreparedStatementLike {
      return new SqliteStatement(db.prepare(sql));
    },
    /**
     * 关闭数据库
     */
    close(): void {
      db.close();
    },
  };
}

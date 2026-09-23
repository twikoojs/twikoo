/**
 * Cloudflare D1 绑定的**最小结构面**。
 *
 * 刻意不自带 `@cloudflare/workers-types`：类型包会把整套 Workers 运行时类型（含与
 * `@types/node` 重叠的 `Request` / `Response` / `Buffer` 面）拉进编译单元，而本适配器
 * 真正用到的只有 D1 的四个方法。按结构面声明既够用，也避免"类型包版本漂移导致
 * 全仓 tsc 与 wrangler 的运行时类型不一致"。
 *
 * 平台核对：Cloudflare D1 Workers binding API（2026-09-23）。
 * - `prepare(sql)` → 预编译语句，`bind(...)` 逐参绑定（**只支持位置参数 `?`**）；
 * - `first(column?)` → 首行（给列名时只取该列的值）；无行返回 null；
 * - `all()` → 全部行（写语句带 `RETURNING` 时同样走它）；
 * - `run()` → 写语句结果，`meta.changes` 为影响行数。
 */

/** D1 语句执行结果（只取本适配器用到的字段） */
export interface D1ResultLike<T = unknown> {
  /** 查询结果行（写语句无 RETURNING 时不出现） */
  results?: T[];
  /** 执行元信息（`changes` 为影响行数） */
  meta?: {
    /** 影响行数 */
    changes?: number;
  };
  /** 是否成功 */
  success?: boolean;
}

/** D1 预编译语句 */
export interface D1PreparedStatementLike {
  /**
   * 绑定位置参数
   * @param values 参数值（按 `?` 顺序）
   * @returns 绑定后的语句（原语句实例）
   */
  bind(...values: unknown[]): D1PreparedStatementLike;
  /**
   * 取首行
   * @param column 只取该列的值
   * @returns 首行 / 该列的值；无行返回 null
   */
  first<T = unknown>(column?: string): Promise<T | null>;
  /**
   * 取全部行
   * @returns 结果集
   */
  all<T = unknown>(): Promise<D1ResultLike<T>>;
  /**
   * 执行写语句
   * @returns 执行结果（含 `meta.changes`）
   */
  run(): Promise<D1ResultLike>;
}

/** D1 数据库绑定（`env.DB`） */
export interface D1DatabaseLike {
  /**
   * 预编译语句
   * @param sql SQL 文本
   * @returns 预编译语句
   */
  prepare(sql: string): D1PreparedStatementLike;
}

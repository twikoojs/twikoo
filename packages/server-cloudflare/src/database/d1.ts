/**
 * D1Database（Cloudflare D1 的 {@link Database} 端口实现）。
 *
 * **为什么用 D1 而不是 KV/BlobKV**：评论区是「读多写多且要求强一致」的场景
 * （发完评论必须立刻可见、限流计数必须准），D1 是 SQLite 强一致存储；
 * 且 1.x twikoo-cloudflare 就用 D1，表形态对齐后站长可直接沿用既有数据（见 `schema.ts`）。
 *
 * **语义查询 → SQL 翻译**（`{ rid: ABSENT }` 这类语义对象见 `@twikoojs/common`
 * 的 `ports/database.ts`）：
 *
 * | 语义条件 | SQL |
 * | --- | --- |
 * | `ABSENT` | `("col" IS NULL OR "col" = '')` |
 * | 数组值 / `{ $in: [...] }` | `"col" IN (?, ?, …)`（空数组 → `0 = 1`，SQLite 的 `IN ()` 是语法错误） |
 * | `{ [NOT]: v }` | `("col" IS NULL OR "col" <> ?)`（缺列视为「不等于」，与 Mongo `$ne` 一致） |
 * | `{ [GT]: v }` / `{ [LT]: v }` | `"col" > ?` / `"col" < ?` |
 * | 标量 / `null` | `"col" = ?` / `"col" IS NULL` |
 *
 * **扩展字段**：`CommentDoc` 有索引签名兜底（导入器可能带 `ups` / `downs` / 未来字段），
 * 这些列不进表结构，改为整体存进 `comment.extra` 的 JSON；读取时先展开 `extra` 再以
 * 已知列为准覆盖，于是「读出什么就写回什么」。查询条件用未知字段时退化为
 * `json_extract("extra", '$.字段')`（依赖 D1 的 JSON1 函数）。
 *
 * **不做的两件事**（刻意保持薄）：
 * - 不实现 `batch`：批量导入按 1.x 的逐条 `save()` 语义串行执行，单条失败即可见；
 * - 不做事务包裹：D1 的 `batch` 才是原子单元，而本端口的 19 个方法都是单语句操作。
 */
import { ABSENT, GT, LT, NOT } from "@twikoojs/common";
import type {
  CommentDoc,
  ConfigData,
  CounterDoc,
  Database,
  QueryOptions,
  SemanticQuery,
} from "@twikoojs/common";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./binding";
import { ensureSchema } from "./schema";
import { lookupRegion, rememberRegion } from "../geo/region-store";

/** 列的存储形态（决定读写时的编解码方式） */
type ColumnKind = "text" | "bool" | "json" | "number";

/**
 * 已知列清单（1.x twikoo-cloudflare 的 21 列 + 2.0 新增的 `extra`）。
 *
 * `bool` 列在 SQLite 里是 INTEGER 0/1（1.x 同款）；`json` 列存 JSON 文本；
 * `extra` 由 {@link collectExtra} 单独处理，不在此表（它不是「一个字段」）。
 */
const COMMENT_COLUMNS: Record<string, ColumnKind> = {
  _id: "text",
  uid: "text",
  nick: "text",
  mail: "text",
  mailMd5: "text",
  link: "text",
  avatar: "text",
  ua: "text",
  ip: "text",
  ipRegion: "text",
  master: "bool",
  url: "text",
  href: "text",
  comment: "text",
  pid: "text",
  rid: "text",
  like: "json",
  top: "bool",
  isSpam: "bool",
  created: "number",
  updated: "number",
};

/** 已知列名（稳定顺序：INSERT 的列序与参数序都取它） */
const COMMENT_COLUMN_NAMES = Object.keys(COMMENT_COLUMNS);

/** `extra` 列名 */
const EXTRA_COLUMN = "extra";

/**
 * 生成评论主键（1.x `uuid().replace(/-/g, '')` 对齐，32 位十六进制串）。
 * 用 Web 标准的 `crypto.randomUUID`：Workers 与 Node 18+ 均原生提供，零依赖。
 * @returns 评论 id
 */
export function newD1CommentId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * 标量安全字符串化（对象走 JSON，避免把 `[object Object]` 写进库或读出来）。
 * @param value 值
 * @returns 字符串（null/undefined 为空串）
 */
function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === undefined || value === null) return "";
  return JSON.stringify(value) ?? "";
}

/**
 * 列编码：文档字段值 → SQL 绑定值。
 * @param kind 列的存储形态
 * @param value 文档字段值
 * @returns 绑定值
 */
function encodeColumn(kind: ColumnKind, value: unknown): unknown {
  if (kind === "bool") return value === true || value === 1 ? 1 : 0;
  if (kind === "json") return JSON.stringify(value ?? []);
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) ? value : 0;
  return toText(value);
}

/**
 * 列解码：SQL 值 → 文档字段值。
 * @param kind 列的存储形态
 * @param value 列值
 * @returns 文档字段值（该列无值时返回 undefined）
 */
function decodeColumn(kind: ColumnKind, value: unknown): unknown {
  if (kind === "bool") {
    if (value === null || value === undefined) return undefined;
    return value === 1 || value === true;
  }
  if (kind === "json") {
    if (typeof value !== "string" || !value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // 历史脏数据（手改过库 / 早期版本写坏）不应让整次查询失败
      return [];
    }
  }
  if (kind === "number") {
    if (value === null || value === undefined) return undefined;
    return typeof value === "number" ? value : Number(value);
  }
  if (value === null || value === undefined) return undefined;
  return toText(value);
}

/**
 * 查询条件里的标量编码（布尔 → 0/1，与列编码保持一致）。
 * @param value 条件值
 * @returns 绑定值
 */
function encodeConditionScalar(value: unknown): unknown {
  if (value === true) return 1;
  if (value === false) return 0;
  return value;
}

/**
 * 解析 `extra` 列。
 * @param raw 列值
 * @returns 扩展字段表（脏数据时返回空表）
 */
function parseExtra(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 文档 → 「已知列」绑定值（列序与 {@link COMMENT_COLUMN_NAMES} 一致）。
 * @param doc 评论文档
 * @returns 绑定值数组
 */
function knownValues(doc: CommentDoc): unknown[] {
  return COMMENT_COLUMN_NAMES.map((name) => encodeColumn(COMMENT_COLUMNS[name], doc[name]));
}

/**
 * 文档 → 扩展字段表（所有非已知列的字段）。
 * @param doc 评论文档
 * @returns 扩展字段表
 */
function collectExtra(doc: CommentDoc): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, key)) continue;
    if (key === EXTRA_COLUMN) continue;
    extra[key] = value;
  }
  return extra;
}

/**
 * 数据行 → 评论文档（先展开 `extra`，再由已知列覆盖——已知列是权威形态）。
 * @param row 数据行
 * @returns 评论文档
 */
function rowToDoc(row: Record<string, unknown>): CommentDoc {
  const doc: CommentDoc = parseExtra(row[EXTRA_COLUMN]);
  for (const name of COMMENT_COLUMN_NAMES) {
    const value = decodeColumn(COMMENT_COLUMNS[name], row[name]);
    if (value !== undefined) doc[name] = value;
  }
  return doc;
}

/** WHERE 子句与它的绑定参数 */
interface WhereClause {
  /** SQL 片段（以 ` WHERE ` 开头；无条件时为空串） */
  sql: string;
  /** 绑定参数 */
  params: unknown[];
}

/**
 * 字段名 → SQL 表达式。
 * @param field 字段名
 * @param params 参数数组（未知字段会追加 json_extract 的路径参数）
 * @returns SQL 表达式
 */
function fieldExpression(field: string, params: unknown[]): string {
  if (Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, field)) return `"${field}"`;
  // 未知字段（扩展字段）住在 extra 的 JSON 里：路径参数化绑定，不拼字符串
  params.push(`$.${field}`);
  return `json_extract("${EXTRA_COLUMN}", ?)`;
}

/**
 * 追加一个字段条件。
 * @param field 字段名
 * @param condition 条件值
 * @param parts 条件片段数组
 * @param params 绑定参数数组
 */
function appendCondition(
  field: string,
  condition: unknown,
  parts: string[],
  params: unknown[],
): void {
  const expr = fieldExpression(field, params);
  if (condition === ABSENT) {
    parts.push(`(${expr} IS NULL OR ${expr} = ?)`);
    params.push("");
    return;
  }
  if (Array.isArray(condition)) {
    appendIn(expr, condition, parts, params);
    return;
  }
  if (condition !== null && typeof condition === "object") {
    const object = condition as Record<symbol | string, unknown>;
    if (NOT in object) {
      parts.push(`(${expr} IS NULL OR ${expr} <> ?)`);
      params.push(encodeConditionScalar(object[NOT]));
      return;
    }
    if (GT in object) {
      parts.push(`${expr} > ?`);
      params.push(object[GT]);
      return;
    }
    if (LT in object) {
      parts.push(`${expr} < ?`);
      params.push(object[LT]);
      return;
    }
    if ("$in" in object && Array.isArray(object.$in)) {
      appendIn(expr, object.$in, parts, params);
      return;
    }
    // 早失败优于静默返回空集：语义条件不认识的形态一律报错
    throw new Error(`D1 查询条件不支持该形态：${field}`);
  }
  if (condition === null) {
    parts.push(`${expr} IS NULL`);
    return;
  }
  parts.push(`${expr} = ?`);
  params.push(encodeConditionScalar(condition));
}

/**
 * 追加 `IN` 条件（空集合退化为恒假：SQLite 的 `IN ()` 是语法错误）。
 * @param expr 字段 SQL 表达式
 * @param values 集合
 * @param parts 条件片段数组
 * @param params 绑定参数数组
 */
function appendIn(
  expr: string,
  values: unknown[],
  parts: string[],
  params: unknown[],
): void {
  if (!values.length) {
    parts.push("1 = 0");
    return;
  }
  parts.push(`${expr} IN (${values.map(() => "?").join(", ")})`);
  params.push(...values.map((value) => encodeConditionScalar(value)));
}

/**
 * 语义查询 → WHERE 子句。
 * @param query 语义查询对象
 * @returns WHERE 子句
 */
function buildWhere(query: SemanticQuery): WhereClause {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const [field, condition] of Object.entries(query)) {
    appendCondition(field, condition, parts, params);
  }
  return { sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", params };
}

/**
 * 查询选项 → `ORDER BY` + `LIMIT/OFFSET` 片段。
 *
 * 排序字段只认已知列（扩展字段没有索引，且可能整列不存在）；`OFFSET` 在 SQLite 里
 * 必须挂在 `LIMIT` 上，故「只给 skip」时用 `LIMIT -1 OFFSET n` 表达「不限条数」。
 * @param options 查询选项
 * @returns 片段与绑定参数
 */
function buildOrderAndPage(options?: QueryOptions): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  let sql = "";
  if (!options) return { sql, params };
  if (options.sort) {
    const orders: string[] = [];
    for (const [field, direction] of Object.entries(options.sort)) {
      if (!Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, field)) continue;
      orders.push(`"${field}" ${direction === -1 ? "DESC" : "ASC"}`);
    }
    if (orders.length) sql += ` ORDER BY ${orders.join(", ")}`;
  }
  if (options.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(options.limit);
    if (options.skip !== undefined) {
      sql += " OFFSET ?";
      params.push(options.skip);
    }
  } else if (options.skip !== undefined) {
    sql += " LIMIT -1 OFFSET ?";
    params.push(options.skip);
  }
  return { sql, params };
}

/**
 * 数据行 → 计数字档。
 * @param row 数据行
 * @returns 计数字档
 */
function rowToCounter(row: Record<string, unknown>): CounterDoc {
  const title = row.title;
  const doc: CounterDoc = {
    url: toText(row.url),
    time: Number(row.time ?? 0),
  };
  if (typeof title === "string" && title) doc.title = title;
  const created = decodeColumn("number", row.created);
  if (created !== undefined) doc.created = created as number;
  const updated = decodeColumn("number", row.updated);
  if (updated !== undefined) doc.updated = updated as number;
  return doc;
}

/**
 * D1 数据库实现（Cloudflare Workers 适配器使用）。
 */
export class D1Database implements Database {
  /** D1 绑定（`env.DB`） */
  private readonly db: D1DatabaseLike;

  /**
   * @param db D1 绑定
   */
  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  /**
   * 生命周期：初始化（建表 + 1.x 增量升级；过程幂等，同一绑定只跑一次）。
   */
  async init(): Promise<void> {
    await ensureSchema(this.db);
  }

  /**
   * 数据行 → 文档，并把库里的属地回填进属地缓存（供 `binarySearchSync` 同步命中）。
   *
   * 这一步是 Cloudflare 的属地方案能成立的关键：DTO 层是按评论的 `ip` 反查属地的，
   * 而 Workers 无法按任意 IP 查询，故靠「读评论时顺手登记」把库里的属地塞进
   * 进程内缓存（`ip2region: true` 由 `setCustomLibs` 覆写满足，见 `geo/region-store.ts`）。
   * @param rows 数据行
   * @returns 评论文档列表
   */
  private toDocs(rows: Array<Record<string, unknown>>): CommentDoc[] {
    const docs = rows.map((row) => rowToDoc(row));
    for (const doc of docs) {
      rememberRegion(doc.ip, doc.ipRegion as string | undefined);
    }
    return docs;
  }

  /**
   * 预编译 + 绑定。
   * @param sql SQL 文本
   * @param params 绑定参数
   * @returns 语句
   */
  private stmt(sql: string, params: unknown[] = []): D1PreparedStatementLike {
    const prepared = this.db.prepare(sql);
    return params.length ? prepared.bind(...params) : prepared;
  }

  /** 评论：获取全部评论（导出用，自然序） */
  async getAllComments(): Promise<CommentDoc[]> {
    const { results } = await this.stmt(`SELECT * FROM "comment"`).all<Record<string, unknown>>();
    return this.toDocs(results ?? []);
  }

  /** 评论：语义查询 + 排序/分页 */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const where = buildWhere(query);
    const page = buildOrderAndPage(options);
    const { results } = await this.stmt(
      `SELECT * FROM "comment"${where.sql}${page.sql}`,
      [...where.params, ...page.params],
    ).all<Record<string, unknown>>();
    return this.toDocs(results ?? []);
  }

  /** 评论：按语义查询计数 */
  async countComments(query: SemanticQuery): Promise<number> {
    const where = buildWhere(query);
    const count = await this.stmt(
      `SELECT COUNT(*) AS "count" FROM "comment"${where.sql}`,
      where.params,
    ).first<number>("count");
    return count ?? 0;
  }

  /** 评论：按 id 取单条（不存在返回 null） */
  async getComment(id: string): Promise<CommentDoc | null> {
    const row = await this.stmt(`SELECT * FROM "comment" WHERE "_id" = ?`, [id]).first<
      Record<string, unknown>
    >();
    if (!row) return null;
    return this.toDocs([row])[0] ?? null;
  }

  /** 评论：新增（回填 _id 与属地；扩展字段进 extra） */
  async addComment(data: CommentDoc): Promise<CommentDoc> {
    const doc: CommentDoc = { ...data, _id: data._id ?? newD1CommentId() };
    // 1.x D1 行为：提交评论时把本次请求的属地随评论落库（读取该评论时才有属地可显示）
    if (!doc.ipRegion) {
      const region = lookupRegion(doc.ip);
      if (region) doc.ipRegion = region;
    }
    const columns = [...COMMENT_COLUMN_NAMES, EXTRA_COLUMN];
    await this.stmt(
      `INSERT INTO "comment" (${columns.map((name) => `"${name}"`).join(", ")})` +
        ` VALUES (${columns.map(() => "?").join(", ")})`,
      [...knownValues(doc), JSON.stringify(collectExtra(doc))],
    ).run();
    return doc;
  }

  /** 评论：按 id 部分更新（未提及字段保持不变；扩展字段合并进 extra） */
  async updateComment(id: string, data: Partial<CommentDoc>): Promise<void> {
    const assignments: string[] = [];
    const params: unknown[] = [];
    const extraPatch: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(data)) {
      if (Object.prototype.hasOwnProperty.call(COMMENT_COLUMNS, field)) {
        assignments.push(`"${field}" = ?`);
        params.push(encodeColumn(COMMENT_COLUMNS[field], value));
      } else if (field !== EXTRA_COLUMN) {
        extraPatch[field] = value;
      }
    }
    if (Object.keys(extraPatch).length) {
      // 合并前先读回现值：extra 是「整列替换」，不读会把别的扩展字段一起抹掉
      const row = await this.stmt(`SELECT "${EXTRA_COLUMN}" FROM "comment" WHERE "_id" = ?`, [
        id,
      ]).first<Record<string, unknown>>();
      assignments.push(`"${EXTRA_COLUMN}" = ?`);
      params.push(JSON.stringify({ ...parseExtra(row?.[EXTRA_COLUMN]), ...extraPatch }));
    }
    if (!assignments.length) return;
    await this.stmt(`UPDATE "comment" SET ${assignments.join(", ")} WHERE "_id" = ?`, [
      ...params,
      id,
    ]).run();
  }

  /** 评论：按 id 删除 */
  async deleteComment(id: string): Promise<void> {
    await this.stmt(`DELETE FROM "comment" WHERE "_id" = ?`, [id]).run();
  }

  /** 评论：批量导入（1.x 逐条 save 语义：串行写入，便于定位坏数据） */
  async bulkAddComments(list: CommentDoc[]): Promise<void> {
    for (const item of list) {
      await this.addComment(item);
    }
  }

  /** 计数：读取页面计数（无记录返回 null） */
  async getCounter(url: string): Promise<CounterDoc | null> {
    const row = await this.stmt(`SELECT * FROM "counter" WHERE "url" = ?`, [url]).first<
      Record<string, unknown>
    >();
    return row ? rowToCounter(row) : null;
  }

  /** 计数：获取全部页面计数（导出用） */
  async getAllCounters(): Promise<CounterDoc[]> {
    const { results } = await this.stmt(`SELECT * FROM "counter"`).all<Record<string, unknown>>();
    return (results ?? []).map((row) => rowToCounter(row));
  }

  /**
   * 计数：自增（无记录则创建；1.x 的 upsert + 回查两语句形态）。
   *
   * `title` 缺省时**保留库中已有标题**（1.x 会写成空串，导致「无标题的深链访问」把
   * 页面标题抹掉；这里按「未提供 = 不改」处理）。
   */
  async incCounter(url: string, title?: string): Promise<CounterDoc> {
    const now = Date.now();
    const providedTitle = title === undefined ? null : title;
    await this.stmt(
      `INSERT INTO "counter" ("url", "title", "time", "created", "updated")` +
        ` VALUES (?, COALESCE(?, ''), 1, ?, ?)` +
        ` ON CONFLICT("url") DO UPDATE SET` +
        ` "time" = "counter"."time" + 1,` +
        ` "title" = CASE WHEN ? IS NULL THEN "counter"."title" ELSE ? END,` +
        ` "updated" = ?`,
      [url, providedTitle, now, now, providedTitle, providedTitle, now],
    ).run();
    const doc = await this.getCounter(url);
    return (
      doc ?? {
        url,
        time: 1,
        ...(providedTitle !== null ? { title: providedTitle } : {}),
        created: now,
        updated: now,
      }
    );
  }

  /** 配置：读取（无行 / 空串 / 脏 JSON 均返回 null，由 pipeline 降级为空配置） */
  async getConfig(): Promise<ConfigData | null> {
    const value = await this.stmt(`SELECT "value" FROM "config" LIMIT 1`).first<string>("value");
    if (typeof value !== "string" || !value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as ConfigData;
    } catch {
      return null;
    }
  }

  /** 配置：保存（合并语义：1.x / BlobKV 的 `{ ...current, ...config }` 对齐） */
  async saveConfig(config: ConfigData): Promise<void> {
    const merged: ConfigData = { ...((await this.getConfig()) ?? {}), ...config };
    const json = JSON.stringify(merged);
    // 1.x 的 config 表是「单行无主键」：先保证有行，再整表覆盖。
    // 刻意不用 `run()` 的 meta.changes 判断（D1 与测试替身对它的填充强度不一致）
    await this.stmt(
      `INSERT INTO "config" ("value") SELECT ? WHERE NOT EXISTS (SELECT 1 FROM "config")`,
      [json],
    ).run();
    await this.stmt(`UPDATE "config" SET "value" = ?`, [json]).run();
  }

  /** 验证码：按 key 读取（无值返回 null） */
  async capGet(key: string): Promise<unknown> {
    const value = await this.stmt(`SELECT "value" FROM "cap_kv" WHERE "key" = ?`, [key]).first<
      string
    >("value");
    if (typeof value !== "string" || !value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /** 验证码：按 key 写入（存在则覆盖；`expires` 单独成列以便按下标清理） */
  async capSet(key: string, value: unknown): Promise<void> {
    const expires =
      value !== null && typeof value === "object" && typeof (value as { expires?: unknown }).expires === "number"
        ? (value as { expires: number }).expires
        : null;
    await this.stmt(
      `INSERT INTO "cap_kv" ("key", "value", "expires") VALUES (?, ?, ?)` +
        ` ON CONFLICT("key") DO UPDATE SET "value" = excluded."value", "expires" = excluded."expires"`,
      [key, JSON.stringify(value ?? null), expires],
    ).run();
  }

  /** 验证码：按 key 删除（不存在时为空操作） */
  async capDel(key: string): Promise<void> {
    await this.stmt(`DELETE FROM "cap_kv" WHERE "key" = ?`, [key]).run();
  }

  /** 验证码：删除已过期记录（下推为带索引的批量 DELETE） */
  async capDeleteExpired(now: number): Promise<number> {
    const result = await this.stmt(
      `DELETE FROM "cap_kv" WHERE "expires" IS NOT NULL AND "expires" < ?`,
      [now],
    ).run();
    return result.meta?.changes ?? 0;
  }
}

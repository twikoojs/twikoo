/**
 * CloudBaseDatabase（规范；1.x `src/server/function/twikoo/index.js`
 * 的 TCB 集合操作语义对齐）。
 *
 * 语义要点：
 * - 集合固定四张：`comment` / `config` / `counter` / `cap_kv`（1.7.24 集合名
 *   对齐；1.x 的 cap_challenges/cap_tokens 两张在 2.0 由 cap_kv 统一承载，
 *   cap 数据为 10 分钟级短命数据，无迁移影响）；
 * - `{ rid: ABSENT }` → `_.in(["", null])`（1.x L288 `rid: _.in(['', null])` 对齐）；
 * - 计数器自增 `time: _.inc(1)` + `update` 未命中则 `add`（1.x incCounter 对齐）；
 * - 配置保存合并语义（`where({}).limit(1).update(newConfig)` 的 $set 形态）；
 * - `where({})` 必须显式传入（1.x 注释：不加 where 会报错
 *   「param should have required property 'query'」）。
 *
 * 依赖外部化：`@cloudbase/node-sdk` 仅在 CloudBase 运行时可用，由适配器
 * `tcb.init()` 后把 `database()` 句柄注入本实现；公共库不静态依赖 SDK，
 * 单测以结构化 mock 覆盖（验收方式）。
 */
import { ABSENT, GT, LT, NOT } from "../ports/database";
import type {
  CommentDoc,
  ConfigData,
  CounterDoc,
  Database,
  QueryOptions,
  SemanticQuery,
} from "../ports/database";

/** CloudBase 查询指令的项目使用面（db.command） */
export interface CloudBaseCommandLike {
  /**
   * 属于集合之一
   * @param list 取值列表
   * @returns 指令对象（透传给 SDK）
   */
  in(list: unknown[]): unknown;
  /**
   * 自增
   * @param n 步长
   * @returns 指令对象（透传给 SDK）
   */
  inc(n: number): unknown;
  /**
   * 不等于
   * @param value 比较值
   * @returns 指令对象（透传给 SDK）
   */
  neq(value: unknown): unknown;
  /**
   * 大于
   * @param value 比较值
   * @returns 指令对象（透传给 SDK）
   */
  gt(value: unknown): unknown;
  /**
   * 小于（流式分页游标 `created < before`）
   * @param value 比较值
   * @returns 指令对象（透传给 SDK）
   */
  lt(value: unknown): unknown;
}

/** CloudBase 查询链的项目使用面（collection().where() 返回值） */
export interface CloudBaseQueryLike {
  /**
   * 读取匹配文档
   * @returns { data: 文档数组 }
   */
  get(): Promise<{ data: unknown[] }>;
  /**
   * 匹配计数
   * @returns { total: 条数 }
   */
  count(): Promise<{ total: number }>;
  /**
   * 排序
   * @param field 字段名
   * @param direction 方向（asc/desc）
   * @returns 查询链（可继续链式）
   */
  orderBy(field: string, direction: "asc" | "desc"): CloudBaseQueryLike;
  /**
   * 跳过条数（分页）
   * @param n 条数
   * @returns 查询链（可继续链式）
   */
  skip(n: number): CloudBaseQueryLike;
  /**
   * 限制条数
   * @param n 条数
   * @returns 查询链（可继续链式）
   */
  limit(n: number): CloudBaseQueryLike;
  /**
   * 批量更新匹配文档（$set 合并语义）
   * @param data 更新载荷
   * @returns { updated: 条数 }
   */
  update(data: object): Promise<{ updated?: number }>;
  /**
   * 删除匹配文档
   * @returns { deleted: 条数 }
   */
  remove(): Promise<{ deleted?: number }>;
}

/** CloudBase 文档句柄（collection().doc(id)） */
export interface CloudBaseDocRefLike {
  /**
   * 读取单文档
   * @returns { data?: 文档 }
   */
  get(): Promise<{ data?: unknown }>;
  /**
   * 更新单文档（$set 合并语义）
   * @param data 更新载荷
   * @returns 更新结果
   */
  update(data: object): Promise<unknown>;
  /**
   * 删除单文档
   * @returns 删除结果
   */
  delete(): Promise<unknown>;
}

/** CloudBase 集合句柄的项目使用面 */
export interface CloudBaseCollectionLike {
  /**
   * 条件查询（必须显式传入条件对象，可为空对象）
   * @param cond 查询条件
   * @returns 查询链
   */
  where(cond: Record<string, unknown>): CloudBaseQueryLike;
  /**
   * 新增文档（单个或数组；SDK 生成 _id）
   * @param data 文档或文档数组
   * @returns { id / ids }
   */
  add(data: object | object[]): Promise<{ id?: string; ids?: string[] }>;
  /**
   * 按文档 id 取句柄
   * @param id 文档 id
   * @returns 文档句柄
   */
  doc(id: string): CloudBaseDocRefLike;
}

/** CloudBase 数据库句柄的项目使用面（tcb.init().database()） */
export interface CloudBaseDatabaseLike {
  /**
   * 取集合句柄
   * @param name 集合名
   * @returns 集合句柄
   */
  collection(name: string): CloudBaseCollectionLike;
  /** 查询指令（db.command） */
  command: CloudBaseCommandLike;
}

/** CloudBaseDatabase 构造选项 */
export interface CloudBaseDatabaseOptions {
  /**
   * CloudBase 数据库句柄（适配器注入；env 由 tcb.init 解析）
   */
  database: CloudBaseDatabaseLike;
}

/**
 * 语义查询对象 → TCB where 条件。
 * @param query 语义查询对象
 * @param command 查询指令（构造 _.in 指令）
 * @returns TCB 查询条件
 */
export function toTcbCondition(
  query: SemanticQuery,
  command: CloudBaseCommandLike,
): Record<string, unknown> {
  /** TCB 查询条件 */
  const condition: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === ABSENT) {
      // 「字段缺失/为空」：_.in(["", null])（1.x L288 对齐；TCB 的 in 命中 null 与缺失）
      condition[key] = command.in(["", null]);
    } else if (Array.isArray(value)) {
      condition[key] = command.in(value);
    } else if (typeof value === "object" && value !== null && "$in" in value) {
      // Mongo 风格 $in 对象（COMMENT_GET 的 url 多形态查询传入）
      condition[key] = command.in((value as { $in: unknown[] }).$in);
    } else if (typeof value === "object" && value !== null && NOT in value) {
      condition[key] = command.neq(value[NOT]);
    } else if (typeof value === "object" && value !== null && GT in value) {
      condition[key] = command.gt(value[GT]);
    } else if (typeof value === "object" && value !== null && LT in value) {
      // 「小于」语义（流式分页游标）
      condition[key] = command.lt(value[LT]);
    } else {
      condition[key] = value;
    }
  }
  return condition;
}

/**
 * CloudBase 数据库实现（server-cloudbase / twikoo-func 适配器使用）。
 * init()/close() 为空操作（连接由 tcb.init 托管；接口幂等）。
 */
export class CloudBaseDatabase implements Database {
  /** 数据库句柄 */
  private readonly db: CloudBaseDatabaseLike;

  /**
   * @param options 数据库句柄选项
   */
  constructor(options: CloudBaseDatabaseOptions) {
    this.db = options.database;
  }

  /**
   * 取集合句柄。
   * @param name 集合名
   * @returns 集合句柄
   */
  private col(name: string): CloudBaseCollectionLike {
    return this.db.collection(name);
  }

  /**
   * 生命周期：初始化（连接由 tcb.init 托管，此处为端口幂等空操作）。
   */
  async init(): Promise<void> {}

  /** 生命周期：关闭（端口幂等空操作） */
  async close(): Promise<void> {}

  /** 评论：获取全部评论（TCB 服务端单次 get 上限 1000，1.x 导出同形态） */
  async getAllComments(): Promise<CommentDoc[]> {
    const res = await this.col("comment").where({}).limit(1000).get();
    return res.data as CommentDoc[];
  }

  /** 评论：语义查询 + 排序/分页（orderBy/skip/limit 链式，1.x commentGet 对齐） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const cond = toTcbCondition(query, this.db.command);
    let q = this.col("comment").where(cond);
    if (options?.sort) {
      for (const [field, direction] of Object.entries(options.sort)) {
        q = q.orderBy(field, direction === -1 ? "desc" : "asc");
      }
    }
    if (options?.skip !== undefined) q = q.skip(options.skip);
    if (options?.limit !== undefined) q = q.limit(options.limit);
    const res = await q.get();
    return res.data as CommentDoc[];
  }

  /** 评论：按语义查询计数 */
  async countComments(query: SemanticQuery): Promise<number> {
    const res = await this.col("comment").where(toTcbCondition(query, this.db.command)).count();
    return res.total;
  }

  /** 评论：按 id 取单条（不存在返回 null；1.x getParentComment 的 where+get 形态） */
  async getComment(id: string): Promise<CommentDoc | null> {
    const res = await this.col("comment").where({ _id: id }).get();
    return (res.data[0] as CommentDoc) ?? null;
  }

  /** 评论：新增（SDK 生成 _id 并回填到返回文档；1.x save 的 add 形态） */
  async addComment(data: CommentDoc): Promise<CommentDoc> {
    const result = await this.col("comment").add({ ...data });
    const doc = { ...data, _id: data._id ?? result.id };
    return doc;
  }

  /** 评论：按 id 部分更新（doc().update $set 语义，1.x saveSpamCheckResult 形态） */
  async updateComment(id: string, data: Partial<CommentDoc>): Promise<void> {
    await this.col("comment").doc(id).update(data);
  }

  /** 评论：按 id 删除（1.x commentDeleteForAdmin 的 doc().delete() 形态） */
  async deleteComment(id: string): Promise<void> {
    await this.col("comment").doc(id).delete();
  }

  /** 评论：批量导入（TCB add 支持数组，1.x bulkSaveComments 形态） */
  async bulkAddComments(list: CommentDoc[]): Promise<void> {
    if (!list.length) return;
    await this.col("comment").add(list.map((item) => ({ ...item })));
  }

  /** 计数：读取页面计数（where+get 取首条；无记录返回 null） */
  async getCounter(url: string): Promise<CounterDoc | null> {
    const res = await this.col("counter").where({ url }).get();
    return (res.data[0] as CounterDoc) ?? null;
  }

  /** 计数：获取全部页面计数（导出用；TCB 服务端单次 get 上限 1000，与 getAllComments 同形态） */
  async getAllCounters(): Promise<CounterDoc[]> {
    const res = await this.col("counter").where({}).limit(1000).get();
    return res.data as CounterDoc[];
  }

  /** 计数：自增（update 未命中则 add；1.x incCounter 的 _.inc 语义） */
  async incCounter(url: string, title?: string): Promise<CounterDoc> {
    const now = Date.now();
    /** 更新载荷（title 未传不写入） */
    const update: Record<string, unknown> = { updated: now };
    if (title !== undefined) update.title = title;
    const result = await this.col("counter")
      .where({ url })
      .update({
        ...update,
        time: this.db.command.inc(1),
      });
    if ((result.updated ?? 0) === 0) {
      await this.col("counter").add({
        url,
        time: 1,
        ...(title !== undefined ? { title } : {}),
        created: now,
        updated: now,
      });
    }
    const doc = await this.getCounter(url);
    if (!doc) throw new Error(`计数器自增失败：${url}`);
    return doc;
  }

  /** 配置：读取单文档（limit(1) 首条；未初始化返回 null；1.x readConfig 形态） */
  async getConfig(): Promise<ConfigData | null> {
    const res = await this.col("config").where({}).limit(1).get();
    const doc = res.data[0] as ConfigData | undefined;
    if (!doc) return null;
    delete (doc as { _id?: unknown })._id;
    return doc;
  }

  /** 配置：保存（update 合并语义 + add 兜底，1.x writeConfig 逐形态对齐） */
  async saveConfig(config: ConfigData): Promise<void> {
    const result = await this.col("config").where({}).limit(1).update(config);
    if ((result.updated ?? 0) === 0) {
      await this.col("config").add({ ...config });
    }
  }

  /** 验证码：按 key 读取（不存在返回 null） */
  async capGet(key: string): Promise<unknown> {
    const res = await this.col("cap_kv").where({ key }).get();
    const doc = res.data[0] as { value?: unknown } | undefined;
    return doc ? doc.value : null;
  }

  /** 验证码：按 key 写入（update 未命中则 add） */
  async capSet(key: string, value: unknown): Promise<void> {
    const result = await this.col("cap_kv").where({ key }).update({ value });
    if ((result.updated ?? 0) === 0) {
      await this.col("cap_kv").add({ key, value });
    }
  }

  /** 验证码：按 key 删除（where+remove；未命中不报错） */
  async capDel(key: string): Promise<void> {
    await this.col("cap_kv").where({ key }).remove();
  }
}

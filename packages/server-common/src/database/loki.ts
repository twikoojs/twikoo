/* eslint-disable @typescript-eslint/require-await --
 * Loki 为同步内核，Database 端口为异步契约（与 MongoDatabase 同构）；
 * 全部方法的 Promise 包装是端口形态要求，非可去除的冗余。
 */
/**
 * LokiDatabase（规范 §6.4；1.x `src/server/self-hosted/index.js` 语义对齐，R-3 重点）。
 *
 * 语义要点（与 MongoDatabase 完全一致的对外语义，实现各自翻译）：
 * - `{ rid: ABSENT }` 的 Loki 翻译：Loki 无 Mongo 的 `$in 含 null 命中缺失`
 *   语义，1.x 用 `rid: { $exists: false }`（漏掉显式 null/空串——1.x 两套
 *   实现真实存在的语义偏差，R-3 风险点）。2.0 统一为 chain().find(其余条件)
 *   + `where()` 谓词补过滤「缺失 / null / 空串」三形态，与 Mongo
 *   `{ $in: ["", null] }` 等价；
 * - 排序分页：`compoundsort` + `offset` + `limit`（1.x L492-496 对齐）；
 * - 评论 `_id` 为 32 位 uuid 字符串（与 1.x parse() 一致，跨库统一）；
 * - 持久化：loki-fs-structured-adapter + `autosaveInterval: 4000` +
 *   `close()` 落盘（1.x connectToDatabase L261-267 对齐）；
 * - 配置：真替换语义（旧键不在新配置中即移除，与 Mongo replaceOne 对齐）。
 *
 * D-2 依赖外部化：lokijs 运行时动态加载，由 tkserver 适配器安装。
 */
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { ABSENT } from "../ports/database";
import type {
  CommentDoc,
  ConfigData,
  CounterDoc,
  Database,
  QueryOptions,
  SemanticQuery,
} from "../ports/database";

/** Loki 数据库实例类型（ambient 声明见 src/types/lokijs.d.ts） */
type LokiInstance = import("lokijs").default;

/** Loki 集合类型 */
type LokiColl = import("lokijs").LokiCollectionType;

/** LokiDatabase 构造选项 */
export interface LokiDatabaseOptions {
  /**
   * 数据目录（db.json 存放于此；由适配器从 TWIKOO_DATA 环境变量解析后传入，
   * 公共库不感知环境变量——与 §6.3 IP 解析上移同一纪律）。
   */
  dataDir: string;
}

/**
 * 生成评论主键（1.x parse() 的 `_id: uuidv4().replace(/-/g, '')` 对齐）。
 * @returns 32 位小写十六进制字符串
 */
export function newLokiCommentId(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * 剥除 Loki 运行时元数据字段（$loki / meta），只保留业务字段——
 * 返回**浅拷贝**，绝不触碰存储对象本体（原地删除 meta 会让后续
 * collection.update() 报「unsynced document」）。
 * @param doc Loki 文档
 * @returns 业务文档（浅拷贝）
 */
function stripLokiMeta<T>(doc: LokiDoc): T {
  const copy: Record<string, unknown> = { ...doc };
  delete copy.$loki;
  delete copy.meta;
  return copy as T;
}

/**
 * 把语义查询拆为「Loki find 条件」+「ABSENT 谓词」两部分。
 * ABSENT 无法用 Loki 算子直接表达（$exists: false 漏 null/空串），其余
 * 条件走原生 find（等值 / $in）。
 * @param query 语义查询对象
 * @returns find 条件与 ABSENT 字段清单
 */
function splitLokiQuery(query: SemanticQuery): {
  base: Record<string, unknown>;
  absentKeys: string[];
} {
  /** 原生 find 条件 */
  const base: Record<string, unknown> = {};
  /** 需要 ABSENT 谓词补过滤的字段 */
  const absentKeys: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === ABSENT) {
      absentKeys.push(key);
    } else if (Array.isArray(value)) {
      base[key] = { $in: value };
    } else {
      base[key] = value;
    }
  }
  return { base, absentKeys };
}

/**
 * LokiJS 数据库实现（self-hosted / tkserver 使用）。
 * init() 幂等：加载完成后复用（1.x connectToDatabase 的 if (db) return 语义）。
 */
export class LokiDatabase implements Database {
  /** 数据目录 */
  private readonly dataDir: string;

  /** 缓存的 Loki 实例（init 后非空） */
  private loki: LokiInstance | null = null;

  /**
   * @param options 数据目录选项
   */
  constructor(options: LokiDatabaseOptions) {
    this.dataDir = options.dataDir;
  }

  /**
   * 取集合句柄（init 后调用）。
   * @param name 集合名
   * @returns 集合句柄
   */
  private col(name: string): LokiColl {
    if (!this.loki) throw new Error("数据库尚未初始化（init() 未调用或失败）");
    const collection = this.loki.getCollection(name);
    if (!collection) throw new Error(`Loki 集合 ${name} 不存在（init 未完成？）`);
    return collection;
  }

  /**
   * 生命周期：初始化——确保数据目录存在、加载（或创建）db.json、
   * 建立全部集合并启用自动保存（1.x connectToDatabase + createCollections）。
   */
  async init(): Promise<void> {
    if (this.loki) return;
    if (!existsSync(this.dataDir)) {
      // 数据目录不存在则创建；不可写（父级为文件/权限不足）在此抛可读错误，
      // 且不会产生半写的 db.json（目录就绪先于 Loki 构造）
      mkdirSync(this.dataDir, { recursive: true });
    }
    const Loki = (await import("lokijs")).default;
    const { default: LokiFsStructuredAdapter } =
      await import("lokijs/src/loki-fs-structured-adapter");
    const dbFile = resolve(this.dataDir, "db.json");
    /** 构造在闭包内完成，经局部变量取回实例（规避 TS 对闭包赋值的收窄限制） */
    let instance: LokiInstance | null = null;
    await new Promise<void>((resolvePromise) => {
      instance = new Loki(dbFile, {
        adapter: new LokiFsStructuredAdapter(),
        autoload: true,
        /** autoload 完成回调：解除 init() 的 Promise 等待 */
        autoloadCallback: () => resolvePromise(),
        autosave: true,
        autosaveInterval: 4000,
      });
    });
    const loki = instance as unknown as LokiInstance;
    this.loki = loki;
    // 建立全部集合（1.x createCollections 对齐；cap_kv 为 2.0 统一验证码 KV）
    const collections = ["comment", "config", "counter", "cap_kv"];
    for (const name of collections) {
      if (!loki.getCollection(name)) {
        loki.addCollection(name);
      }
    }
  }

  /** 生命周期：保存落盘并关闭（1.x shutdown() → Loki close 语义） */
  async close(): Promise<void> {
    if (!this.loki) return;
    const loki = this.loki;
    this.loki = null;
    await new Promise<void>((resolvePromise) => {
      loki.close(() => resolvePromise());
    });
  }

  /** 评论：获取全部评论（导出用） */
  async getAllComments(): Promise<CommentDoc[]> {
    return this.col("comment")
      .find({})
      .map((doc) => stripLokiMeta<CommentDoc>(doc));
  }

  /** 评论：语义查询 + 排序/分页（find → compoundsort → offset → limit → data） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const { base, absentKeys } = splitLokiQuery(query);
    let rs = this.col("comment").chain().find(base);
    for (const key of absentKeys) {
      // ABSENT = 缺失 / null / 空串（与 Mongo $in: ["", null] 严格等价，R-3）
      rs = rs.where((doc) => {
        const value = doc[key];
        return value === undefined || value === null || value === "";
      });
    }
    if (options?.sort) {
      // SortSpec { f: 1|-1 } → Loki compoundsort [[f, 是否降序], ...]
      const sortOrder: Array<[string, boolean]> = Object.entries(options.sort).map(
        ([field, direction]) => [field, direction === -1],
      );
      rs = rs.compoundsort(sortOrder);
    }
    if (options?.skip !== undefined) rs = rs.offset(options.skip);
    if (options?.limit !== undefined) rs = rs.limit(options.limit);
    return rs.data().map((doc) => stripLokiMeta<CommentDoc>(doc));
  }

  /** 评论：按语义查询计数（ABSENT 谓词同样生效） */
  async countComments(query: SemanticQuery): Promise<number> {
    const { base, absentKeys } = splitLokiQuery(query);
    let rs = this.col("comment").chain().find(base);
    for (const key of absentKeys) {
      rs = rs.where((doc) => {
        const value = doc[key];
        return value === undefined || value === null || value === "";
      });
    }
    return rs.count();
  }

  /** 评论：按 id 取单条（不存在返回 null） */
  async getComment(id: string): Promise<CommentDoc | null> {
    const doc = this.col("comment").findOne({ _id: id });
    return doc ? stripLokiMeta<CommentDoc>(doc) : null;
  }

  /** 评论：新增（_id 缺失时生成 32 位 uuid 串） */
  async addComment(data: CommentDoc): Promise<CommentDoc> {
    const doc: CommentDoc = { ...data, _id: data._id ?? newLokiCommentId() };
    this.col("comment").insert(doc);
    return doc;
  }

  /** 评论：按 id 部分更新（未提及字段保持不变） */
  async updateComment(id: string, data: Partial<CommentDoc>): Promise<void> {
    const doc = this.col("comment").findOne({ _id: id });
    if (!doc) return;
    Object.assign(doc, data);
    this.col("comment").update(doc);
  }

  /** 评论：按 id 删除（未命中不报错） */
  async deleteComment(id: string): Promise<void> {
    const doc = this.col("comment").findOne({ _id: id });
    if (doc) this.col("comment").remove(doc);
  }

  /** 评论：批量导入（缺失 _id 的条目补 32 位 uuid 串） */
  async bulkAddComments(list: CommentDoc[]): Promise<void> {
    if (!list.length) return;
    const docs = list.map((item) => ({ ...item, _id: item._id ?? newLokiCommentId() }));
    this.col("comment").insert(docs);
  }

  /** 计数：读取页面计数（无记录返回 null） */
  async getCounter(url: string): Promise<CounterDoc | null> {
    const doc = this.col("counter").findOne({ url });
    return doc ? stripLokiMeta<CounterDoc>(doc) : null;
  }

  /** 计数：自增（存在则累加，不存在则创建；1.x incCounter L972-990 对齐） */
  async incCounter(url: string, title?: string): Promise<CounterDoc> {
    const counter = this.col("counter");
    const existing = counter.findOne({ url });
    if (existing) {
      existing.time = existing.time ? Number(existing.time) + 1 : 1;
      if (title !== undefined) existing.title = title;
      existing.updated = Date.now();
      counter.update(existing);
      return existing as unknown as CounterDoc;
    }
    /** 新计数文档 */
    const created: CounterDoc = {
      url,
      time: 1,
      ...(title !== undefined ? { title } : {}),
      created: Date.now(),
      updated: Date.now(),
    };
    counter.insert(created);
    return created;
  }

  /** 配置：读取单文档（未初始化返回 null） */
  async getConfig(): Promise<ConfigData | null> {
    const doc = this.col("config").findOne({});
    return doc ? stripLokiMeta<ConfigData>(doc) : null;
  }

  /** 配置：全量保存（真替换：旧键不在新配置中即移除，与 Mongo replaceOne 对齐） */
  async saveConfig(config: ConfigData): Promise<void> {
    const col = this.col("config");
    const existing = col.findOne({});
    if (existing) {
      // 移除旧键再合并新值：保证「全量保存」语义（不是增量 $set）。
      // $loki / meta 为 Loki 运行时元数据，必须保留（update 依赖 meta.version）
      for (const key of Object.keys(existing)) {
        if (key !== "$loki" && key !== "meta" && !(key in config)) {
          delete existing[key];
        }
      }
      Object.assign(existing, config);
      col.update(existing);
    } else {
      col.insert({ ...config });
    }
  }

  /** 验证码：按 key 读取（不存在返回 null） */
  async capGet(key: string): Promise<unknown> {
    const doc = this.col("cap_kv").findOne({ key });
    return doc ? doc.value : null;
  }

  /** 验证码：按 key 写入（存在则覆盖） */
  async capSet(key: string, value: unknown): Promise<void> {
    const col = this.col("cap_kv");
    const existing = col.findOne({ key });
    if (existing) {
      existing.value = value;
      col.update(existing);
    } else {
      col.insert({ key, value });
    }
  }

  /** 验证码：按 key 删除 */
  async capDel(key: string): Promise<void> {
    const doc = this.col("cap_kv").findOne({ key });
    if (doc) this.col("cap_kv").remove(doc);
  }
}

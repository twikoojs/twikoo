/**
 * MongoDatabase（规范；1.x `src/server/vercel/api/index.js` 语义对齐）。
 *
 * 语义要点（与 1.x 行为一致）：
 * - 评论 `_id` 为 **32 位 uuid 字符串**（1.x parse() 生成，非 ObjectId），
 *   全部按字符串等值查询；
 * - 「顶级评论」查询 `{ rid: ABSENT }` 翻译为 `{ rid: { $in: ["", null] } }`——
 *   Mongo 中 `$in` 含 `null` 时同时命中「字段缺失」「null」「空串」三种形态，
 *   与 1.x `rid: { $in: ['', null] }` 逐字对齐（1.x 未用 `$exists: false`，
 *   因其无法命中显式空串，见基线 L329/L998）；
 * - 计数器自增：`$inc time + $set title/updated`，命中 0 条则插入首条
 *   （1.x incCounter 的 update → insert 兜底）；
 * - 配置：单文档形态，`updateOne({}, $set, upsert)`（1.x writeConfig 的
 *   update → insert 兜底的原子化等价）；
 * - 验证码 KV：`cap_kv` 集合（cap 三方法为通用形态；1.x cap_challenges/
 *   cap_tokens 为 10 分钟级短命数据，由存储适配器在其上组装过期过滤）。
 *
 * 依赖外部化：mongodb 驱动**运行时动态加载**（init() 内 `await import`），
 * 驱动由声明 `mongodb` 依赖的适配器安装（peerDependenciesMeta optional）。
 * 类型面经 `typeof import("mongodb")`（编译期擦除，不产生静态依赖）。
 */
import { randomUUID } from "node:crypto";
import { ABSENT, GT, LT, NOT } from "../ports/database";
import type {
  CommentDoc,
  ConfigData,
  CounterDoc,
  Database,
  QueryOptions,
  SemanticQuery,
} from "../ports/database";

/** mongodb 驱动模块类型（仅类型位引用，编译期擦除） */
type MongoNs = typeof import("mongodb");

/** Mongo 客户端类型 */
type MongoClient = InstanceType<MongoNs["MongoClient"]>;

/** Mongo 数据库类型 */
type MongoDb = ReturnType<MongoClient["db"]>;

/** Mongo 集合类型 */
type MongoCollection = ReturnType<MongoDb["collection"]>;

/** Mongo 文档（驱动以 any 边界为主，内部统一收窄为键值记录） */
type MongoDoc = Record<string, unknown>;

/** Mongo 查询过滤器类型（驱动 Filter 泛型的类型面） */
type MongoFilter = Parameters<MongoCollection["findOne"]>[0];

/**
 * 构造字符串主键过滤器。
 * 驱动类型把 `_id` 条件限定为 ObjectId 族，而 twikoo 的评论主键是 1.x 约定的
 * 32 位 uuid 字符串，驱动按字符串等值写入与查询完全一致——此处对类型面做
 * 一次集中收窄，业务代码保持纯净。
 * @param id 字符串主键
 * @returns Mongo 过滤器
 */
function idFilter(id: string): MongoFilter {
  return { _id: id } as unknown as MongoFilter;
}

/** MongoDatabase 构造选项 */
export interface MongoDatabaseOptions {
  /** 连接串（如 mongodb://…/twikoo 或 mongodb+srv://…/twikoo） */
  uri: string;
  /** 数据库名（不传则从 uri pathname 推导，1.x connectToDatabase 语义） */
  dbName?: string;
}

/**
 * 语义查询对象 → Mongo 过滤器（翻译职责）。
 * @param query 语义查询对象
 * @returns Mongo 过滤器
 */
export function toMongoFilter(query: SemanticQuery): MongoDoc {
  /** 输出过滤器 */
  const filter: MongoDoc = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === ABSENT) {
      // 「字段缺失/为空」语义：$in 含 null 同时命中缺失与 null（见文件头说明）
      filter[key] = { $in: ["", null] };
    } else if (Array.isArray(value)) {
      // 数组值 = 「属于集合之一」（1.x url $in getUrlsQuery(urls) 语义）
      filter[key] = { $in: value };
    } else if (typeof value === "object" && value !== null && NOT in value) {
      // 「不等于」语义：$ne（缺失字段视为不等，Mongo 原生语义）
      filter[key] = { $ne: value[NOT] };
    } else if (typeof value === "object" && value !== null && GT in value) {
      // 「大于」语义：$gt
      filter[key] = { $gt: value[GT] };
    } else if (typeof value === "object" && value !== null && LT in value) {
      // 「小于」语义：$lt（流式分页游标）
      filter[key] = { $lt: value[LT] };
    } else {
      filter[key] = value;
    }
  }
  return filter;
}

/**
 * 生成评论主键（1.x parse() 的 `_id: uuidv4().replace(/-/g, '')` 对齐）。
 * @returns 32 位小写十六进制字符串
 */
export function newCommentId(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * MongoDB 数据库实现（vercel / cloudbase-mongo 形态适配器使用）。
 * init() 幂等：连接缓存后复用（1.x connectToDatabase 的 if (db) return 语义）。
 */
export class MongoDatabase implements Database {
  /** 连接串 */
  private readonly uri: string;

  /** 数据库名（空则从 uri 推导） */
  private readonly dbName?: string;

  /** 缓存的驱动客户端（init 后非空） */
  private client: MongoClient | null = null;

  /** 缓存的数据库句柄（init 后非空） */
  private db: MongoDb | null = null;

  /**
   * @param options 连接选项（uri 必传；运行环境未配置时 init 抛可读错误）
   */
  constructor(options: MongoDatabaseOptions) {
    this.uri = options.uri;
    this.dbName = options.dbName;
  }

  /**
   * 取集合句柄（init 后调用）。
   * @param name 集合名
   * @returns 集合句柄
   */
  private col(name: string): MongoCollection {
    if (!this.db) throw new Error("数据库尚未初始化（init() 未调用或失败）");
    return this.db.collection(name);
  }

  /** 生命周期：建连（幂等，连接缓存；uri 缺失抛可读错误，1.x 文案对齐） */
  async init(): Promise<void> {
    if (this.db) return;
    if (!this.uri) throw new Error("未设置环境变量 MONGODB_URI");
    const mongo: MongoNs = await import("mongodb");
    this.client = new mongo.MongoClient(this.uri);
    // 1.x 的 useNewUrlParser/useUnifiedTopology 选项在驱动 4+ 已废弃（6.x 移除），不再传递
    await this.client.connect();
    // 数据库名取连接串 pathname 首段（1.x connectToDatabase 对齐）
    const derived = new URL(this.uri).pathname.replace(/^\//, "").split("?")[0];
    this.db = this.client.db(this.dbName || derived);
  }

  /** 生命周期：关闭连接（self-hosted shutdown / 测试收尾用） */
  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.db = null;
  }

  /** 评论：获取全部评论（导出用，按自然序） */
  async getAllComments(): Promise<CommentDoc[]> {
    const docs = await this.col("comment").find({}).toArray();
    return docs as unknown as CommentDoc[];
  }

  /** 评论：语义查询 + 排序/分页（1.x find().sort().skip().limit().toArray() 对齐） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const cursor = this.col("comment").find(toMongoFilter(query));
    if (options?.sort) cursor.sort(options.sort);
    if (options?.skip !== undefined) cursor.skip(options.skip);
    if (options?.limit !== undefined) cursor.limit(options.limit);
    const docs = await cursor.toArray();
    return docs as unknown as CommentDoc[];
  }

  /** 评论：按语义查询计数（1.x countDocuments 对齐） */
  async countComments(query: SemanticQuery): Promise<number> {
    return this.col("comment").countDocuments(toMongoFilter(query));
  }

  /** 评论：按 id 取单条（字符串等值；不存在返回 null） */
  async getComment(id: string): Promise<CommentDoc | null> {
    const doc = await this.col("comment").findOne(idFilter(id));
    return (doc as unknown as CommentDoc) ?? null;
  }

  /** 评论：新增（_id 缺失时生成 32 位 uuid 串；驱动插入的文档不回写，返回补齐 _id 的副本） */
  async addComment(data: CommentDoc): Promise<CommentDoc> {
    const doc: CommentDoc = { ...data, _id: data._id ?? newCommentId() };
    await this.col("comment").insertOne(doc as unknown as MongoDoc);
    return doc;
  }

  /** 评论：按 id 部分更新（$set 语义：未提及字段保持不变，1.x 对齐） */
  async updateComment(id: string, data: Partial<CommentDoc>): Promise<void> {
    await this.col("comment").updateOne(idFilter(id), { $set: data as MongoDoc });
  }

  /** 评论：按 id 删除（1.x deleteOne 对齐；未命中不报错） */
  async deleteComment(id: string): Promise<void> {
    await this.col("comment").deleteOne(idFilter(id));
  }

  /** 评论：批量导入（缺失 _id 的条目补 32 位 uuid 串，避免驱动生成 ObjectId 破坏字符串 id 语义） */
  async bulkAddComments(list: CommentDoc[]): Promise<void> {
    if (!list.length) return;
    const docs = list.map((item) => ({ ...item, _id: item._id ?? newCommentId() }));
    await this.col("comment").insertMany(docs as unknown as MongoDoc[]);
  }

  /** 计数：读取页面计数（无记录返回 null） */
  async getCounter(url: string): Promise<CounterDoc | null> {
    const doc = await this.col("counter").findOne({ url });
    return (doc as unknown as CounterDoc) ?? null;
  }

  /** 计数：获取全部页面计数（导出用，按自然序） */
  async getAllCounters(): Promise<CounterDoc[]> {
    const docs = await this.col("counter").find({}).toArray();
    return docs as unknown as CounterDoc[];
  }

  /** 计数：自增（update 命中 0 条则插入首条；1.x incCounter 兜底语义） */
  async incCounter(url: string, title?: string): Promise<CounterDoc> {
    const now = Date.now();
    /** $set 载荷：title 未传时不写入（与 1.x 写 null 的消费端表现等价） */
    const set: MongoDoc = { updated: now };
    if (title !== undefined) set.title = title;
    const result = await this.col("counter").updateOne({ url }, { $inc: { time: 1 }, $set: set });
    if (result.modifiedCount === 0) {
      await this.col("counter").insertOne({
        url,
        title,
        time: 1,
        created: now,
        updated: now,
      });
    }
    const doc = await this.getCounter(url);
    if (!doc) throw new Error(`计数器自增失败：${url}`);
    return doc;
  }

  /** 配置：读取单文档（_id 为 Mongo 主键，无业务用途，剥除后返回；未初始化返回 null） */
  async getConfig(): Promise<ConfigData | null> {
    const doc = await this.col("config").findOne({});
    if (!doc) return null;
    delete (doc as { _id?: unknown })._id;
    return doc;
  }

  /** 配置：保存（$set 合并语义，与 1.x writeConfig 对齐——setPassword 只写单键依赖合并；未初始化时 upsert 建档） */
  async saveConfig(config: ConfigData): Promise<void> {
    await this.col("config").updateOne({}, { $set: config as MongoDoc }, { upsert: true });
  }

  /** 验证码：按 key 读取（不存在返回 null） */
  async capGet(key: string): Promise<unknown> {
    const doc = await this.col("cap_kv").findOne({ key });
    return doc ? doc.value : null;
  }

  /** 验证码：按 key 写入（存在则覆盖） */
  async capSet(key: string, value: unknown): Promise<void> {
    await this.col("cap_kv").updateOne({ key }, { $set: { key, value } }, { upsert: true });
  }

  /** 验证码：按 key 删除 */
  async capDel(key: string): Promise<void> {
    await this.col("cap_kv").deleteOne({ key });
  }

  /**
   * 验证码：删除已过期记录（cap_kv 的值形如 `{ expires }`）。
   *
   * 下推为 `deleteMany({ "value.expires": { $lt: now } })`——该集合正是
   * 「过期不清理会无限增长」的那个，绝不能全量拉回再逐条删。
   * @param now 当前时间戳（毫秒）
   * @returns 删除条数
   */
  async capDeleteExpired(now: number): Promise<number> {
    const result = await this.col("cap_kv").deleteMany({ "value.expires": { $lt: now } });
    return result.deletedCount ?? 0;
  }
}

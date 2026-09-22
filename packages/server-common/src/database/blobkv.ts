/**
 * BlobKvDatabase（规范；1.x `src/server/eo-makers/cloud-functions/index.js`
 * 的 createBlobDatabase 语义对齐）。
 *
 * 语义要点：
 * - 评论以**整表 JSON** 存于单键 `comments:all`（进程内缓存读放大消除，
 *   1.x commentsCache 语义）；配置 `config:main`；计数器
 *   `counter:${encodeURIComponent(url)}`（1.x key 设计逐字对齐）；
 * - 语义查询在 JS 层过滤（ABSENT = 缺失/null/空串，与 Mongo/Loki 等价）；
 * - 缺失 key 返回空值而非抛错（getAllComments → []、getCounter → null、
 *   capGet → null，1.7.24 行为一致）；
 * - 配置保存为合并语义（1.x `{ ...current, ...newConfig }` 对齐）；
 * - 构造时注入 KV store 句柄（EO Makers 的 @edgeone/pages-blob
 *   `getStore({ name: 'twikoo', consistency: 'strong' })` 由适配器创建后传入），
 *   公共库不感知平台 SDK——单测用内存 fake 即可覆盖。
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

/**
 * Blob KV 存储句柄（@edgeone/pages-blob getStore 返回值的项目使用面）。
 * 平台差异由适配器包一层薄转换消化。
 */
export interface BlobKvStoreLike {
  /**
   * 读取键值
   * @param key 键名
   * @param options 读取选项（type: json 反序列化）
   * @returns 键值；不存在返回 null/undefined
   */
  get(key: string, options?: { type?: "json" | "text" }): Promise<unknown>;
  /**
   * 写入 JSON 值
   * @param key 键名
   * @param value 任意可 JSON 序列化值
   */
  setJSON(key: string, value: unknown): Promise<void>;
  /**
   * 删除键
   * @param key 键名
   */
  delete(key: string): Promise<void>;
  /**
   * 按键前缀列举（计数导出用；平台 SDK 的 list 已默认聚合同名前缀的全部页）
   * @param options 选项（prefix 前缀过滤）
   * @returns 匹配的键名列表
   */
  list(options?: { prefix?: string }): Promise<{ blobs: Array<{ key: string }> }>;
}

/** 评论整表键（1.x COMMENTS_KEY 对齐） */
const COMMENTS_KEY = "comments:all";

/** 配置键（1.x 对齐） */
const CONFIG_KEY = "config:main";

/** 计数键前缀（1.x key 设计逐字对齐；导出按键前缀枚举） */
const COUNTER_KEY_PREFIX = "counter:";

/** 验证码键前缀（cap:c:<token> / cap:t:<key>；过期清理按键前缀枚举） */
const CAP_KEY_PREFIX = "cap:";

/**
 * 生成计数键（1.x `counter:${encodeURIComponent(url)}` 对齐）。
 * @param url 页面路径
 * @returns KV 键名
 */
function counterKey(url: string): string {
  return `${COUNTER_KEY_PREFIX}${encodeURIComponent(url)}`;
}

/** 生成评论主键（1.x createBlobDatabase 的 uuid 去连字符对齐） */
function newBlobCommentId(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * 单条件匹配（1.x matchCondition 的语义翻译：ABSENT/数组/标量三形态，
 * 缺失字段按 undefined 处理）。
 * @param doc 评论文档
 * @param key 字段名
 * @param expected 语义条件值
 * @returns 是否匹配
 */
function matchCondition(doc: CommentDoc, key: string, expected: unknown): boolean {
  const actual = doc[key];
  if (expected === ABSENT) return actual === undefined || actual === null || actual === "";
  if (Array.isArray(expected)) return expected.includes(actual);
  if (typeof expected === "object" && expected !== null && "$in" in expected) {
    // Mongo 风格 $in 对象（COMMENT_GET 的 url 多形态查询传入）
    const list = (expected as { $in: unknown[] }).$in;
    return list.includes(actual) || (list.includes(null) && actual === undefined);
  }
  if (typeof expected === "object" && expected !== null && NOT in expected) {
    // 「不等于」：缺失字段视为不等（与 Mongo $ne 一致）
    return actual !== (expected as { [NOT]?: unknown })[NOT];
  }
  if (typeof expected === "object" && expected !== null && GT in expected) {
    return typeof actual === "number" && actual > ((expected as { [GT]?: number })[GT] as number);
  }
  if (typeof expected === "object" && expected !== null && LT in expected) {
    // 「小于」：流式分页游标（缺失/非数值字段不匹配）
    return typeof actual === "number" && actual < ((expected as { [LT]?: number })[LT] as number);
  }
  return actual === expected;
}

/**
 * 语义查询过滤（1.x filterComments 对齐）。
 * @param comments 全部评论
 * @param query 语义查询对象
 * @returns 匹配评论
 */
function filterComments(comments: CommentDoc[], query: SemanticQuery): CommentDoc[] {
  if (!Object.keys(query).length) return comments;
  return comments.filter((comment) =>
    Object.entries(query).every(([key, value]) => matchCondition(comment, key, value)),
  );
}

/**
 * Blob KV 数据库实现（EdgeOne Makers 适配器使用）。
 * init() 为空操作（store 句柄构造即就绪）；close() 为空操作。
 */
export class BlobKvDatabase implements Database {
  /** KV store 句柄 */
  private readonly store: BlobKvStoreLike;

  /** 评论整表缓存（null = 未加载；1.x commentsCache 语义） */
  private commentsCache: CommentDoc[] | null = null;

  /**
   * @param store KV store 句柄（适配器注入）
   */
  constructor(store: BlobKvStoreLike) {
    this.store = store;
  }

  /** 生命周期：初始化（store 句柄构造即就绪，端口幂等空操作） */
  async init(): Promise<void> {}

  /** 生命周期：关闭（端口幂等空操作） */
  async close(): Promise<void> {}

  /** 评论：获取全部评论（命中进程内缓存则不读 KV） */
  async getAllComments(): Promise<CommentDoc[]> {
    if (this.commentsCache !== null) return this.commentsCache;
    this.commentsCache = ((await this.store.get(COMMENTS_KEY, { type: "json" })) ??
      []) as CommentDoc[];
    return this.commentsCache;
  }

  /**
   * 评论：写回整表（更新缓存 + 落 KV；1.x saveAllComments 语义）
   * @param comments 全部评论
   */
  private async saveAllComments(comments: CommentDoc[]): Promise<void> {
    this.commentsCache = comments;
    await this.store.setJSON(COMMENTS_KEY, comments);
  }

  /** 评论：语义查询 + 排序/分页（JS 层实现；1.x 无 options，2.0 端口统一后补齐） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const matched = filterComments(await this.getAllComments(), query);
    if (!options) return matched;
    let result = [...matched];
    if (options.sort) {
      const keys = Object.entries(options.sort);
      result.sort((a, b) => {
        for (const [field, direction] of keys) {
          const av = a[field] as number | undefined;
          const bv = b[field] as number | undefined;
          const diff = (av ?? 0) - (bv ?? 0);
          if (diff !== 0) return direction === -1 ? -diff : diff;
        }
        return 0;
      });
    }
    if (options.skip !== undefined) result = result.slice(options.skip);
    if (options.limit !== undefined) result = result.slice(0, options.limit);
    return result;
  }

  /** 评论：按语义查询计数 */
  async countComments(query: SemanticQuery): Promise<number> {
    return (await this.getComments(query)).length;
  }

  /** 评论：按 id 取单条（不存在返回 null） */
  async getComment(id: string): Promise<CommentDoc | null> {
    const comments = await this.getAllComments();
    return comments.find((c) => c._id === id) ?? null;
  }

  /** 评论：新增（_id 缺失生成 32 位 uuid 串；整表写回） */
  async addComment(data: CommentDoc): Promise<CommentDoc> {
    const doc: CommentDoc = { ...data, _id: data._id ?? newBlobCommentId() };
    const comments = await this.getAllComments();
    comments.push(doc);
    await this.saveAllComments(comments);
    return doc;
  }

  /** 评论：按 id 部分更新（未命中为空操作） */
  async updateComment(id: string, data: Partial<CommentDoc>): Promise<void> {
    const comments = await this.getAllComments();
    const target = comments.find((c) => c._id === id);
    if (!target) return;
    Object.assign(target, data);
    await this.saveAllComments(comments);
  }

  /** 评论：按 id 删除（未命中为空操作） */
  async deleteComment(id: string): Promise<void> {
    const comments = await this.getAllComments();
    const index = comments.findIndex((c) => c._id === id);
    if (index === -1) return;
    comments.splice(index, 1);
    await this.saveAllComments(comments);
  }

  /** 评论：批量导入（缺失 _id 补齐；单次整表写回） */
  async bulkAddComments(list: CommentDoc[]): Promise<void> {
    if (!list.length) return;
    const comments = await this.getAllComments();
    for (const item of list) {
      comments.push({ ...item, _id: item._id ?? newBlobCommentId() });
    }
    await this.saveAllComments(comments);
  }

  /** 计数：读取页面计数（缺失 key 返回 null，不抛错） */
  async getCounter(url: string): Promise<CounterDoc | null> {
    const doc = await this.store.get(counterKey(url), { type: "json" });
    return (doc as CounterDoc) ?? null;
  }

  /** 计数：获取全部页面计数（按键前缀枚举后逐个取值；导出用） */
  async getAllCounters(): Promise<CounterDoc[]> {
    const { blobs } = await this.store.list({ prefix: COUNTER_KEY_PREFIX });
    const docs = await Promise.all(
      blobs.map((blob) => this.store.get(blob.key, { type: "json" }) as Promise<CounterDoc | null>),
    );
    return docs.filter((doc) => doc !== null && doc !== undefined);
  }

  /** 计数：自增（存在则累加，不存在创建；1.x incCounter 对齐） */
  async incCounter(url: string, title?: string): Promise<CounterDoc> {
    const key = counterKey(url);
    const existing = (await this.store.get(key, { type: "json" })) as CounterDoc | null;
    let doc: CounterDoc;
    if (existing) {
      doc = {
        ...existing,
        time: (existing.time || 0) + 1,
        ...(title !== undefined ? { title } : {}),
        updated: Date.now(),
      };
    } else {
      doc = {
        url,
        time: 1,
        ...(title !== undefined ? { title } : {}),
        created: Date.now(),
        updated: Date.now(),
      };
    }
    await this.store.setJSON(key, doc);
    return doc;
  }

  /** 配置：读取（缺失 key 返回 null，不抛错；pipeline 侧降级空配置） */
  async getConfig(): Promise<ConfigData | null> {
    const config = await this.store.get(CONFIG_KEY, { type: "json" });
    return (config as ConfigData) ?? null;
  }

  /** 配置：保存（合并语义：1.x `{ ...current, ...newConfig }` 逐字对齐） */
  async saveConfig(config: ConfigData): Promise<void> {
    const current = (await this.getConfig()) ?? {};
    await this.store.setJSON(CONFIG_KEY, { ...current, ...config });
  }

  /** 验证码：按 key 读取（缺失返回 null） */
  async capGet(key: string): Promise<unknown> {
    return (await this.store.get(key, { type: "json" })) ?? null;
  }

  /** 验证码：按 key 写入（存在则覆盖） */
  async capSet(key: string, value: unknown): Promise<void> {
    await this.store.setJSON(key, value);
  }

  /** 验证码：按 key 删除（1.x 容错吞错语义对齐） */
  async capDel(key: string): Promise<void> {
    try {
      await this.store.delete(key);
    } catch {
      // 删除不存在的 key 容错（1.x capDel try/catch 对齐）
    }
  }

  /**
   * 验证码：删除已过期记录（cap_kv 的值形如 `{ expires }`）。
   *
   * BlobKV 无「按键前缀批量删除」原语，故按前缀 list 后逐个判过期再删。
   * @param now 当前时间戳（毫秒）
   * @returns 删除条数
   */
  async capDeleteExpired(now: number): Promise<number> {
    const { blobs } = await this.store.list({ prefix: CAP_KEY_PREFIX });
    let deleted = 0;
    for (const blob of blobs) {
      const value = await this.store.get(blob.key, { type: "json" });
      if (typeof value !== "object" || value === null) continue;
      const expires = (value as { expires?: unknown }).expires;
      if (typeof expires === "number" && expires < now) {
        await this.capDel(blob.key);
        deleted += 1;
      }
    }
    return deleted;
  }
}

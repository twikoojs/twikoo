/**
 * 测试用内存适配器（pipeline / dispatcher 用例的公共 stub）。
 *
 * Database 为最小内存实现（Map 直查，不承载契约套件的完整语义）；
 * mailer / notifier / cap 存储全部记录调用供断言。各实现的实现级测试
 * 不使用本文件——它们分别用 mongodb-memory-server / 临时目录 Loki /
 * 共享契约 runner。
 */
import { ABSENT, GT, LT, NOT } from "../../src/ports/database";
import type { QueryOptions } from "../../src/ports/database";
import type {
  Capabilities,
  CapChallengeData,
  CommentDoc,
  ConfigData,
  CounterDoc,
  Database,
  Mailer,
  Notifier,
  PostSubmitDispatcher,
  SemanticQuery,
  Storage,
  TkAdapters,
  TkRequest,
} from "../../src/index";
import { getPostSubmitService } from "../../src/services/post-submit";

/** 内存 Database 的最小实现形态（方法集与端口一致，语义从简） */
class MemoryDatabase implements Database {
  /** 评论存储（_id → 文档） */
  private comments = new Map<string, CommentDoc>();

  /** 页面计数（url → CounterDoc） */
  private counters = new Map<string, CounterDoc>();

  /** 全量配置（null = 未初始化） */
  public config: ConfigData | null;

  /** 验证码 KV（key → 任意 JSON 值） */
  private caps = new Map<string, unknown>();

  /** @param config 预置配置（readConfig 用） */
  constructor(config: ConfigData | null = null) {
    this.config = config;
  }

  /** 生命周期：内存实现无需初始化 */
  async init(): Promise<void> {}

  /** 评论：全量列表 */
  async getAllComments(): Promise<CommentDoc[]> {
    return [...this.comments.values()];
  }

  /** 评论：按语义查询 + 排序/分页（内存形态） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    let result = (await this.getAllComments()).filter((doc) => matches(doc, query));
    if (options?.sort) {
      const entries = Object.entries(options.sort);
      result = [...result].sort((a, b) => {
        for (const [field, direction] of entries) {
          const av = (a[field] as number | undefined) ?? 0;
          const bv = (b[field] as number | undefined) ?? 0;
          const diff = av - bv;
          if (diff !== 0) return direction === -1 ? -diff : diff;
        }
        return 0;
      });
    }
    if (options?.skip !== undefined) result = result.slice(options.skip);
    if (options?.limit !== undefined) result = result.slice(0, options.limit);
    return result;
  }

  /** 评论：计数 */
  async countComments(query: SemanticQuery): Promise<number> {
    return (await this.getComments(query)).length;
  }

  /** 评论：按 id 取单条 */
  async getComment(id: string): Promise<CommentDoc | null> {
    return this.comments.get(id) ?? null;
  }

  /** 评论：新增（自动生成 _id） */
  async addComment(data: CommentDoc): Promise<CommentDoc> {
    const doc = { ...data, _id: data._id ?? `c${this.comments.size + 1}` };
    this.comments.set(doc._id as string, doc);
    return doc;
  }

  /** 评论：部分更新 */
  async updateComment(id: string, data: Partial<CommentDoc>): Promise<void> {
    const doc = this.comments.get(id);
    if (doc) this.comments.set(id, { ...doc, ...data });
  }

  /** 评论：删除 */
  async deleteComment(id: string): Promise<void> {
    this.comments.delete(id);
  }

  /** 评论：批量导入 */
  async bulkAddComments(list: CommentDoc[]): Promise<void> {
    for (const item of list) await this.addComment(item);
  }

  /** 计数：读取 */
  async getCounter(url: string): Promise<CounterDoc | null> {
    return this.counters.get(url) ?? null;
  }

  /** 计数：全量列表 */
  async getAllCounters(): Promise<CounterDoc[]> {
    return [...this.counters.values()];
  }

  /** 计数：自增 */
  async incCounter(url: string): Promise<CounterDoc> {
    const current = this.counters.get(url) ?? { url, time: 0 };
    const next = { ...current, time: current.time + 1 };
    this.counters.set(url, next);
    return next;
  }

  /** 配置：读取 */
  async getConfig(): Promise<ConfigData | null> {
    return this.config;
  }

  /** 配置：保存（合并语义，与端口契约一致） */
  async saveConfig(config: ConfigData): Promise<void> {
    this.config = { ...(this.config ?? {}), ...config };
  }

  /** 验证码：读取 */
  async capGet(key: string): Promise<unknown> {
    return this.caps.get(key) ?? null;
  }

  /** 验证码：写入 */
  async capSet(key: string, value: unknown): Promise<void> {
    this.caps.set(key, value);
  }

  /** 验证码：删除 */
  async capDel(key: string): Promise<void> {
    this.caps.delete(key);
  }

  /**
   * 验证码：删除已过期记录（cap_kv 的值形如 `{ expires }`）。
   * @param now 当前时间戳（毫秒）
   * @returns 删除条数
   */
  async capDeleteExpired(now: number): Promise<number> {
    let deleted = 0;
    for (const [key, value] of [...this.caps.entries()]) {
      if (typeof value !== "object" || value === null) continue;
      const expires = (value as { expires?: unknown }).expires;
      if (typeof expires === "number" && expires < now) {
        this.caps.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }
}

/**
 * 语义查询的内存等值匹配（ABSENT 视为「字段缺失或为空」）。
 * @param doc 评论文档
 * @param query 语义查询对象
 * @returns 是否匹配
 */
function matches(doc: CommentDoc, query: SemanticQuery): boolean {
  return Object.entries(query).every(([key, expected]) => {
    const actual = doc[key];
    if (expected === ABSENT) return actual === undefined || actual === "" || actual === null;
    // 数组值 = 「属于集合之一」（与 mongo/loki/blobkv/cloudbase 四套实现一致；
    // 缺这一支会让 { _id: [id] } 之类的查询在本替身上恒为 false，测试假绿/假红）
    if (Array.isArray(expected)) return (expected as unknown[]).includes(actual);
    if (typeof expected === "object" && expected !== null && "$in" in expected) {
      // Mongo $in 语义：null 在列表中同时命中字段缺失
      const list = (expected as { $in: unknown[] }).$in;
      return list.includes(actual) || (list.includes(null) && actual === undefined);
    }
    if (typeof expected === "object" && expected !== null && NOT in expected) {
      return actual !== (expected as { [NOT]?: unknown })[NOT];
    }
    if (typeof expected === "object" && expected !== null && GT in expected) {
      return typeof actual === "number" && actual > ((expected as { [GT]?: number })[GT] as number);
    }
    // 「小于」：流式分页游标（与四套实现一致，同样不能缺）
    if (typeof expected === "object" && expected !== null && LT in expected) {
      return typeof actual === "number" && actual < ((expected as { [LT]?: number })[LT] as number);
    }
    return actual === expected;
  });
}

/** 记录型 Mailer（send 调用入参留存供断言） */
class RecordingMailer implements Mailer {
  /** 已发送邮件列表 */
  readonly sent: unknown[] = [];

  /** 记录并「发送成功」 */
  async send(payload: unknown): Promise<void> {
    this.sent.push(payload);
  }
}

/** 记录型 Notifier（notify 调用入参留存供断言） */
class RecordingNotifier implements Notifier {
  /** 已发送通知列表 */
  readonly sent: unknown[] = [];

  /** 记录并「发送成功」 */
  async notify(payload: unknown): Promise<void> {
    this.sent.push(payload);
  }
}

/** 记录型 Cap 存储（challenges / tokens 双组，调用留痕） */
class RecordingStorage implements Storage {
  /** challenge 存取 */
  readonly challenges = {
    /** 记录的 challenge 写入 */
    stored: [] as Array<[string, CapChallengeData]>,
    /** 存储 */
    async store(token: string, data: CapChallengeData): Promise<void> {
      this.stored.push([token, data]);
    },
    /** 读取（恒 null） */
    async read(): Promise<CapChallengeData | null> {
      return null;
    },
    /** 删除（空操作） */
    async delete(): Promise<void> {},
    /** 清理过期（空操作） */
    async deleteExpired(): Promise<void> {},
  };

  /** token 存取 */
  readonly tokens = {
    /** 记录的 token 写入 */
    stored: [] as Array<[string, number]>,
    /** 存储 */
    async store(key: string, expires: number): Promise<void> {
      this.stored.push([key, expires]);
    },
    /** 读取（恒 null） */
    async get(): Promise<number | null> {
      return null;
    },
    /** 删除（空操作） */
    async delete(): Promise<void> {},
    /** 清理过期（空操作） */
    async deleteExpired(): Promise<void> {},
  };
}

/**
 * 记录型派发器（测试用）。
 *
 * 记录每次 `dispatch` 的评论，并**执行真实 postSubmit 服务**——这样断言
 * 「副作用链跑过」的既有用例无需改动。
 *
 * 与生产默认实现（`scaffoldAdapters` 的进程内不等待）的差别：本替身默认
 * `await` 副作用，保证用例的确定性；需要验证「不阻塞响应」时用
 * {@link RecordingDispatcher} 的 `awaitEffects = false` 或注入自定义实现。
 */
export class RecordingDispatcher implements PostSubmitDispatcher {
  /** 已派发的评论（按调用顺序） */
  readonly dispatched: CommentDoc[] = [];

  /** 是否等待副作用完成（默认 true，测试确定性优先） */
  awaitEffects = true;

  /**
   * 记录并执行 postSubmit 服务。
   * @param comment 已入库的评论
   * @param ctx 请求上下文
   */
  async dispatch(comment: CommentDoc, ctx: Parameters<PostSubmitDispatcher["dispatch"]>[1]) {
    this.dispatched.push(comment);
    const run = getPostSubmitService()(comment, ctx);
    if (this.awaitEffects) {
      await run;
    } else {
      void run.catch(() => {});
    }
  }
}

/**
 * 创建内存适配器聚合。
 * @param options.database 预置配置或自定义 Database 实例
 * @param options.capabilities 自定义能力声明（默认全关）
 * @param options.postSubmit 自定义派发实现（默认记录型）
 * @returns 适配器聚合（database.config 可读写；mailer/notifier/storage/postSubmit 为记录型实例）
 */
export function createMemoryAdapters(
  options: {
    database?: Database | ConfigData | null;
    capabilities?: Partial<Capabilities>;
    postSubmit?: PostSubmitDispatcher;
  } = {},
): TkAdapters & {
  mailer: RecordingMailer;
  notifier: RecordingNotifier;
  storage: RecordingStorage;
} {
  const dbOption = options.database;
  const database =
    dbOption && typeof (dbOption as Database).init === "function"
      ? (dbOption as Database)
      : new MemoryDatabase((dbOption as ConfigData | null) ?? null);
  return {
    request: {
      /** 测试恒等转换（真实转换属适配器职责） */
      toTkRequest(raw: unknown): TkRequest {
        return raw as TkRequest;
      },
    },
    response: {
      /** 测试恒等转换 */
      fromTkResponse(response: unknown): unknown {
        return response;
      },
    },
    database,
    storage: new RecordingStorage(),
    mailer: new RecordingMailer(),
    notifier: new RecordingNotifier(),
    postSubmit: options.postSubmit ?? new RecordingDispatcher(),
    capabilities: {
      mail: false,
      domPurify: false,
      ip2region: false,
      akismet: false,
      tencentTms: false,
      imageUpload: false,
      qqAvatar: false,
      ai: false,
      ...options.capabilities,
    },
  };
}

/**
 * 构造内部统一请求（测试辅助：POST / 默认 ip 192.0.2.1）。
 * @param overrides 覆盖字段（松散类型：允许模拟线上任意 body 形状，内部收窄为 TkRequest）
 * @returns 内部统一请求
 */
export function makeRequest(overrides: Record<string, unknown> = {}): TkRequest {
  return {
    method: "POST",
    path: "/api/twikoo",
    query: {},
    body: { event: "GET_FUNC_VERSION" },
    headers: {},
    ip: "192.0.2.1",
    raw: null,
    ...overrides,
  } as TkRequest;
}

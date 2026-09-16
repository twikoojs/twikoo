/**
 * 数据库端口（规范 §6.4 数据库抽象）。
 *
 * 抽象要抓**语义**而非 API（规范原文）：MongoDB / LokiJS / Blob KV / CloudBase DB
 * 各自实现同一接口，业务层不再关心用哪个库。方法名与分组逐条来自 §6.4 方法表：
 * 评论 8 / 计数 2 / 配置 2 / 验证码 3 / 生命周期 2，共 17 个方法。
 *
 * 形态设计：每个方法以独立的函数类型**方法级导出**，再由 {@link Database} 接口聚合——
 * 四个数据库实现（T14-T17）可按方法类型逐一核对签名，契约测试也可按方法粒度引用。
 */

/**
 * 「字段不存在」哨兵（R-3：Loki 无 $exists 的跨库等价）。
 *
 * 动机：1.x 里 Mongo 用 `rid: { $exists: false }`、Loki 用 `rid: { $in: ["", null] }`
 * 表达同一语义（§6.4 重点说明），业务层被迫关心底层差异。2.0 统一为语义查询对象
 * `{ rid: ABSENT }`，各实现自行翻译成自家语法。
 *
 * 设计决策：
 * - 选 Symbol 哨兵而非字符串常量（如 "__ABSENT__"）：Symbol 与真实数据值构造上不可
 *   混淆，杜绝用户评论字段恰好等于哨兵字符串的碰撞；
 * - 选 Symbol.for（全局注册表）而非 Symbol()：本包为 ESM + CJS 双格式产物，Symbol()
 *   在两个模块实例中生成不同引用，跨格式混用（A 依赖走 CJS、B 依赖走 ESM）时
 *   `ABSENT === ABSENT` 会失败；Symbol.for 同名恒等，跨实例安全。
 */
export const ABSENT: unique symbol = Symbol.for("twikoo.db.absent");

/** 语义查询的字段取值：标量 / 数组之一，或 {@link ABSENT} 哨兵（「字段不存在/为空」语义） */
export type FieldValue = string | number | boolean | null | Array<string | number> | typeof ABSENT;

/**
 * 语义查询对象（§6.4 重点）：键为文档字段名，值为等值条件或 {@link ABSENT}。
 * 示例：`{ rid: ABSENT }`（顶级评论）、`{ isSpam: true }`（垃圾评论）、
 * `{ url: "https://…", rid: "xxx" }`（某页面某评论的回复）。各数据库实现自行翻译。
 */
export type SemanticQuery = Record<string, FieldValue>;

/**
 * 评论文档（数据库存储形态）。
 *
 * 字段清单来自 1.x parse() 的 commentDo 语义：uid/nick/mail/mailMd5/link/ua/ip/
 * master/url/href/comment/pid/rid/isSpam/created/updated，QQ 头像补充 avatar，
 * 点赞列表 like，导入数据可携带扩展字段（索引签名兜底）。全部字段可选以容忍
 * 导入 / 导出与 1.x 历史数据的字段缺失。
 */
export interface CommentDoc {
  /** 文档 id（由数据库实现生成） */
  _id?: string;
  /** 评论者匿名标识（cookie uid） */
  uid?: string;
  /** 昵称（缺省「匿名」） */
  nick?: string;
  /** 邮箱 */
  mail?: string;
  /** 邮箱哈希（头像源，1.x 为 md5 或 sha256，取决于 Gravatar CDN 配置） */
  mailMd5?: string;
  /** 个人主页链接 */
  link?: string;
  /** 头像地址（QQ 邮箱评论时补充） */
  avatar?: string;
  /** User-Agent */
  ua?: string;
  /** 评论者 IP */
  ip?: string;
  /** 是否博主本人 */
  master?: boolean;
  /** 评论目标页面路径 */
  url?: string;
  /** 评论目标页面完整地址 */
  href?: string;
  /** 评论内容（已消毒 HTML） */
  comment?: string;
  /** 父评论 id（直接上级；顶级评论为空） */
  pid?: string | null;
  /** 根评论 id（回复目标主题；顶级评论为空 → 查询顶级评论用 ABSENT） */
  rid?: string | null;
  /** 点赞用户 uid 列表 */
  like?: string[];
  /** 是否垃圾评论 */
  isSpam?: boolean;
  /** 创建时间（毫秒时间戳） */
  created?: number;
  /** 更新时间（毫秒时间戳） */
  updated?: number;
  /** 导入器 / 未来版本可附加的扩展字段 */
  [key: string]: unknown;
}

/** 页面评论计数字档（1.x counter 集合语义） */
export interface CounterDoc {
  /** 页面路径 */
  url: string;
  /** 评论条数 */
  time: number;
  /** 页面标题（1.x incCounter 随计数写入） */
  title?: string;
  /** 创建时间（毫秒时间戳） */
  created?: number;
  /** 更新时间（毫秒时间戳） */
  updated?: number;
}

/** 配置数据：扁平键值对（1.x 配置值为字符串；数值/布尔为 2.0 前瞻兼容） */
export type ConfigData = Record<string, string | number | boolean>;

/**
 * 排序说明：字段名 → 方向（1 = 升序，-1 = 降序），与 1.x Mongo
 * `sort({ created: -1 })` 的形态一致，支持多键排序（键顺序即排序优先级）。
 */
export type SortSpec = Record<string, 1 | -1>;

/**
 * 查询选项：排序与分页（1.x Mongo 游标 sort/skip/limit 语义对齐；
 * 1.x commentGet 的「多读 1 条判断 more」属于 handler 层逻辑，组合本选项实现）。
 */
export interface QueryOptions {
  /** 排序（不传 = 实现默认序；Mongo 为自然序） */
  sort?: SortSpec;
  /** 跳过条数（分页起点，1.x skip = per * (page - 1)） */
  skip?: number;
  /** 返回条数上限 */
  limit?: number;
}

/** 生命周期：初始化（如 Mongo 建连 / Loki 加载持久化文件 / Blob KV 探活） */
export type DatabaseInit = () => Promise<void>;

/**
 * 生命周期：关闭（§6.4 标注「可选」——Loki 需要持久化收尾，其余实现可为空操作）。
 * 接口内以可选成员呈现，self-hosted 的 shutdown() 优雅退出会调用。
 */
export type DatabaseClose = () => Promise<void>;

/** 评论：获取全部评论（管理员导出用） */
export type GetAllComments = () => Promise<CommentDoc[]>;

/** 评论：按语义查询对象获取评论列表（可携带排序/分页选项） */
export type GetComments = (query: SemanticQuery, options?: QueryOptions) => Promise<CommentDoc[]>;

/** 评论：按语义查询对象计数 */
export type CountComments = (query: SemanticQuery) => Promise<number>;

/** 评论：按 id 获取单条评论；不存在返回 null */
export type GetComment = (id: string) => Promise<CommentDoc | null>;

/** 评论：新增评论；实现负责生成 _id 并回填到返回的文档 */
export type AddComment = (data: CommentDoc) => Promise<CommentDoc>;

/** 评论：按 id 部分更新评论字段（未提及字段保持不变） */
export type UpdateComment = (id: string, data: Partial<CommentDoc>) => Promise<void>;

/** 评论：按 id 删除单条评论 */
export type DeleteComment = (id: string) => Promise<void>;

/** 评论：批量导入评论（管理员导入 Disqus / Valine / Artalk / 1.x 备份等） */
export type BulkAddComments = (list: CommentDoc[]) => Promise<void>;

/** 计数：获取页面评论计数；无记录返回 null */
export type GetCounter = (url: string) => Promise<CounterDoc | null>;

/** 计数：页面评论计数自增（无记录则创建；title 为可选页面标题，1.x 语义）；返回更新后的计数 */
export type IncCounter = (url: string, title?: string) => Promise<CounterDoc>;

/** 配置：读取全量配置；未初始化返回 null */
export type GetConfig = () => Promise<ConfigData | null>;

/** 配置：全量保存配置 */
export type SaveConfig = (config: ConfigData) => Promise<void>;

/** 验证码：按 key 读取（不存在返回 null）；值须 JSON 可序列化 */
export type CapGet = (key: string) => Promise<unknown>;

/** 验证码：按 key 写入（存在则覆盖） */
export type CapSet = (key: string, value: unknown) => Promise<void>;

/** 验证码：按 key 删除 */
export type CapDel = (key: string) => Promise<void>;

/**
 * 统一数据库接口（§6.4 方法表全量聚合：评论 8 / 计数 2 / 配置 2 / 验证码 3 /
 * 生命周期 2，共 17 个方法）。各实现见 §6.4：MongoDatabase（vercel / cloudbase）、
 * LokiDatabase（self-hosted）、BlobKvDatabase（eo-makers）、CloudBaseDatabase（cloudbase）。
 */
export interface Database {
  /** 生命周期：初始化 */
  init: DatabaseInit;
  /** 生命周期：关闭（可选，见 {@link DatabaseClose}） */
  close?: DatabaseClose;
  /** 评论：获取全部评论 */
  getAllComments: GetAllComments;
  /** 评论：按语义查询对象获取评论列表 */
  getComments: GetComments;
  /** 评论：按语义查询对象计数 */
  countComments: CountComments;
  /** 评论：按 id 获取单条评论 */
  getComment: GetComment;
  /** 评论：新增评论 */
  addComment: AddComment;
  /** 评论：按 id 部分更新 */
  updateComment: UpdateComment;
  /** 评论：按 id 删除 */
  deleteComment: DeleteComment;
  /** 评论：批量导入 */
  bulkAddComments: BulkAddComments;
  /** 计数：获取页面评论计数 */
  getCounter: GetCounter;
  /** 计数：页面评论计数自增 */
  incCounter: IncCounter;
  /** 配置：读取配置 */
  getConfig: GetConfig;
  /** 配置：保存配置 */
  saveConfig: SaveConfig;
  /** 验证码：读取 */
  capGet: CapGet;
  /** 验证码：写入 */
  capSet: CapSet;
  /** 验证码：删除 */
  capDel: CapDel;
}

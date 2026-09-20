/**
 * lokijs 最小类型面。
 *
 * lokijs 1.5.x 不自带类型声明（package.json 无 types 字段），本文件只为
 * 项目实际使用的能力面提供 ambient 声明；驱动本体运行时 `await import()`
 * 动态加载（外部化，eslint no-restricted-imports 强制）。
 */

/**
 * Loki 数据库（lokijs 主类，CJS module.exports = Loki）。
 */
declare class Loki {
  /**
   * @param filename 持久化文件路径
   * @param options 构造选项（autoload / autosave / adapter 等）
   */
  constructor(filename: string, options?: LokiConstructorOptions);
  /**
   * 新增集合
   * @param name 集合名
   * @returns 集合句柄
   */
  addCollection(name: string): LokiCollection;
  /**
   * 获取集合
   * @param name 集合名
   * @returns 集合句柄；不存在返回 null
   */
  getCollection(name: string): LokiCollection | null;
  /**
   * 保存并关闭（停用 autosave）
   * @param callback 关闭完成回调
   */
  close(callback?: () => void): void;
}

/** Loki 构造选项（项目使用面） */
interface LokiConstructorOptions {
  /** 结构化文件适配器实例 */
  adapter?: unknown;
  /** 加载时自动读取持久化文件 */
  autoload?: boolean;
  /** 自动加载完成回调（无参；失败经 error 事件） */
  autoloadCallback?: () => void;
  /** 启用自动保存 */
  autosave?: boolean;
  /** 自动保存间隔（毫秒） */
  autosaveInterval?: number;
}

/** Loki 文档（业务字段 + 运行时元数据） */
interface LokiDoc {
  /** 业务字段（索引签名兜底） */
  [key: string]: unknown;
  /** Loki 内部序号 */
  $loki?: number;
}

/** Loki 集合（项目使用面） */
interface LokiCollection {
  /**
   * 插入文档（单个或数组；插入对象会被附加运行时元数据）
   * @param doc 文档或文档数组
   * @returns 插入结果
   */
  insert(doc: object | object[]): unknown;
  /**
   * 查找第一条匹配文档
   * @param query Loki 查询对象
   * @returns 匹配文档或 null
   */
  findOne(query: object): LokiDoc | null;
  /**
   * 查找全部匹配文档
   * @param query Loki 查询对象
   * @returns 匹配文档数组
   */
  find(query: object): LokiDoc[];
  /**
   * 更新文档（传入带元数据的原始文档引用）
   * @param doc 文档
   */
  update(doc: object): void;
  /**
   * 移除文档
   * @param doc 文档
   */
  remove(doc: object): void;
  /**
   * 按查询计数
   * @param query Loki 查询对象
   * @returns 匹配条数
   */
  count(query: object): number;
  /** 开启链式查询 */
  chain(): LokiResultset;
}

/** Loki 链式查询结果集（项目使用面） */
interface LokiResultset {
  /**
   * 追加查询条件
   * @param query Loki 查询对象
   * @returns 结果集（链式）
   */
  find(query: object): LokiResultset;
  /**
   * 追加 JS 谓词过滤（Loki 查询算子无法表达的条件在此实现）
   * @param fn 谓词函数
   * @returns 结果集（链式）
   */
  where(fn: (doc: LokiDoc) => boolean): LokiResultset;
  /**
   * 复合排序（[字段, 是否降序] 序列，键顺序即排序优先级）
   * @param sortOrder 排序说明
   * @returns 结果集（链式）
   */
  compoundsort(sortOrder: Array<[string, boolean]>): LokiResultset;
  /**
   * 跳过条数（分页）
   * @param count 跳过条数
   * @returns 结果集（链式）
   */
  offset(count: number): LokiResultset;
  /**
   * 限制条数（分页）
   * @param count 条数上限
   * @returns 结果集（链式）
   */
  limit(count: number): LokiResultset;
  /**
   * 当前结果集计数（不物化文档）
   * @returns 匹配条数
   */
  count(): number;
  /**
   * 物化为文档数组
   * @returns 匹配文档数组
   */
  data(): LokiDoc[];
}

declare module "lokijs" {
  export default Loki;
  export type LokiCollectionType = LokiCollection;
}

/**
 * loki-fs-structured-adapter（lokijs 仓库内附带的文件持久化适配器，
 * 1.x self-hosted 同款子路径导入）。
 */
declare module "lokijs/src/loki-fs-structured-adapter.js" {
  /** 结构化文件适配器 */
  class LokiFsStructuredAdapter {
    /** 初始化适配器（lokijs 构造选项 adapter 传入） */
    constructor();
  }
  export default LokiFsStructuredAdapter;
}

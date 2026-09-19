/**
 * 存储端口（规范 ports/storage.ts「Cap 验证码存储」）。
 *
 * 语义对齐 1.x cap.js 的存储适配器族（mongoStorage / tcbStorage / lokiStorage /
 * kvStorage / memoryStorage）：challenges 与 tokens 双组钩子，与 @cap.js/server
 * 的存储适配器同构。2.0 由适配器实现注入（如 eo-makers 的 KV 直通形态），或由
 * 数据库实现基于 Database 的 cap 三方法提供通用形态。
 */

/** 验证码 challenge 数据（expires 为毫秒时间戳；1.x 默认 10 分钟有效期） */
export interface CapChallengeData {
  /** challenge 主体（sha 序列，由验证码库生成） */
  challenge: string;
  /** 过期时间（毫秒时间戳） */
  expires: number;
}

/** challenge 存储钩子 */
export interface CapChallengeStore {
  /** 存储（token 已存在则覆盖） */
  store(token: string, data: CapChallengeData): Promise<void>;
  /** 读取未过期 challenge；不存在或已过期返回 null */
  read(token: string): Promise<CapChallengeData | null>;
  /** 删除 */
  delete(token: string): Promise<void>;
  /** 清理全部过期 challenge（KV 直通形态可为空实现） */
  deleteExpired(): Promise<void>;
}

/** token 存储钩子（redeem 成功后签发的通行 token） */
export interface CapTokenStore {
  /** 存储 token 及其过期时间（毫秒时间戳） */
  store(key: string, expires: number): Promise<void>;
  /** 读取未过期 token 的过期时间；不存在或已过期返回 null */
  get(key: string): Promise<number | null>;
  /** 删除 */
  delete(key: string): Promise<void>;
  /** 清理全部过期 token（KV 直通形态可为空实现） */
  deleteExpired(): Promise<void>;
}

/**
 * Cap 验证码存储端口（mongoStorage / tcbStorage 等各适配器自行实现）。
 */
export interface Storage {
  /** challenge 存取钩子 */
  challenges: CapChallengeStore;
  /** token 存取钩子 */
  tokens: CapTokenStore;
}

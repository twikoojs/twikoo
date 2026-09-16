/**
 * 内嵌 Cap 验证码服务（1.x utils/cap.js 移植；@cap.js/server 为常规依赖）。
 *
 * 存储：1.x 的 mongoStorage / lokiStorage / tcbStorage / kvStorage 四份复制
 * 收敛为**单一 Database 存储适配器**——基于 Database 端口的 cap 三方法
 * （capGet/capSet/capDel），键设计沿用 1.x kvStorage 的 `cap:c:<token>` /
 * `cap:t:<key>` 形态（JSON 序列化值自带过期时间，读取时过滤）。
 */
import Cap from "@cap.js/server";
import type { Database } from "../ports/database";
import type { ConfigData } from "../ports/database";
import type { Storage } from "../ports/storage";
import { RES_CODE } from "../utils/constants";

/** 挑战参数（1.x CHALLENGE_OPTS 对齐：10 分钟有效期） */
export const CHALLENGE_OPTS = {
  /** 挑战数量 */
  challengeCount: 50,
  /** 挑战串长度 */
  challengeSize: 32,
  /** 难度前缀零数 */
  challengeDifficulty: 4,
  /** 有效期（毫秒） */
  expiresMs: 600000,
} as const;

/**
 * 基于 Database 端口的 Cap 存储适配器（challenges/tokens 双组钩子）。
 * @param db 数据库句柄
 * @returns Cap 存储端口
 */
export function databaseCapStorage(db: Database): Storage {
  return {
    challenges: {
      /** 存储挑战（token 存在则覆盖） */
      async store(token: string, data: { challenge: string; expires: number }): Promise<void> {
        await db.capSet(`cap:c:${token}`, data);
      },
      /** 读取未过期挑战 */
      async read(token: string): Promise<{ challenge: string; expires: number } | null> {
        const data = (await db.capGet(`cap:c:${token}`)) as {
          challenge: string;
          expires: number;
        } | null;
        if (!data || data.expires < Date.now()) return null;
        return data;
      },
      /** 删除挑战 */
      async delete(token: string): Promise<void> {
        await db.capDel(`cap:c:${token}`);
      },
      /** 清理过期（JSON 值自带过期时间，读取时惰性过滤，空实现） */
      async deleteExpired(): Promise<void> {},
    },
    tokens: {
      /** 存储通行 token */
      async store(key: string, expires: number): Promise<void> {
        await db.capSet(`cap:t:${key}`, { expires });
      },
      /** 读取未过期 token */
      async get(key: string): Promise<number | null> {
        const data = (await db.capGet(`cap:t:${key}`)) as { expires: number } | null;
        if (!data || data.expires < Date.now()) return null;
        return data.expires;
      },
      /** 删除 token */
      async delete(key: string): Promise<void> {
        await db.capDel(`cap:t:${key}`);
      },
      /** 清理过期（同上，空实现） */
      async deleteExpired(): Promise<void> {},
    },
  };
}

/**
 * 创建内嵌 Cap 实例（1.x createCap 对齐；noFSState 免文件状态）。
 * @param storage 存储适配器（缺省内存形态，由 Cap 库内部处理）
 * @returns Cap 实例
 */
export function createCap(storage?: Storage): Cap {
  return new Cap({
    noFSState: true,
    storage: storage as never,
  });
}

/**
 * 创建挑战（1.x createChallenge 对齐）。
 * @param cap Cap 实例
 * @returns 挑战数据（challenge 列表等）
 */
export async function createChallenge(cap: Cap): Promise<Record<string, unknown>> {
  return await cap.createChallenge(CHALLENGE_OPTS);
}

/**
 * 兑换挑战（1.x redeemChallenge 对齐：token + solutions 校验）。
 * @param cap Cap 实例
 * @param body 请求体（token/solutions）
 * @returns 兑换结果
 */
export async function redeemChallenge(
  cap: Cap,
  body: { token?: string; solutions?: unknown } | undefined,
): Promise<{ success: boolean; token?: string; expires?: number; error?: string }> {
  const token = body && body.token;
  const solutions = body && body.solutions;
  if (!token || !solutions || !Array.isArray(solutions)) {
    return { success: false, error: "Missing token or solutions" };
  }
  return await cap.redeemChallenge({ token, solutions });
}

/**
 * 校验通行 token（1.x validateToken 对齐；异常视为未通过）。
 * @param cap Cap 实例
 * @param token 通行 token
 * @returns 是否有效
 */
export async function validateToken(cap: Cap, token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { success } = await cap.validateToken(token);
    return !!success;
  } catch {
    return false;
  }
}

/**
 * 判断是否使用内嵌 Cap（1.x isBuiltinCap 对齐：CAPTCHA_PROVIDER=Cap 且无外部 endpoint）。
 * @param config 全量配置
 * @returns 是否内嵌 Cap
 */
export function isBuiltinCap(config: ConfigData): boolean {
  return config.CAPTCHA_PROVIDER === "Cap" && !config.CAP_API_ENDPOINT;
}

/**
 * CAP_CHALLENGE 事件处理（1.x capChallenge 对齐：内嵌 Cap 未启用时报错）。
 * @param options 处理入参
 * @returns 挑战响应
 */
export async function capChallenge(options: {
  config: ConfigData;
  db: Database;
}): Promise<Record<string, unknown>> {
  const { config, db } = options;
  if (!isBuiltinCap(config)) {
    return { code: RES_CODE.FAIL, message: "内嵌 Cap 未启用" };
  }
  const data = await createChallenge(createCap(databaseCapStorage(db)));
  return { code: RES_CODE.SUCCESS, ...data };
}

/**
 * CAP_REDEEM 事件处理（1.x capRedeem 对齐）。
 * @param options 处理入参
 * @returns 兑换响应
 */
export async function capRedeem(options: {
  config: ConfigData;
  db: Database;
  body: { token?: string; solutions?: unknown } | undefined;
}): Promise<Record<string, unknown>> {
  const { config, db, body } = options;
  if (!isBuiltinCap(config)) {
    return { code: RES_CODE.FAIL, message: "内嵌 Cap 未启用" };
  }
  const data = await redeemChallenge(createCap(databaseCapStorage(db)), body);
  return { code: RES_CODE.SUCCESS, ...data };
}

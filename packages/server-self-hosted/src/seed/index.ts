/**
 * demo 数据 seed（设计文档）。
 *
 * 触发三态：
 * | 数据状态 | 行为 |
 * | --- | --- |
 * | 数据库文件不存在 | 用默认测试数据生成，日志提示「已生成 N 条测试评论」 |
 * | 文件存在但为空 | 同上（补数据） |
 * | 文件存在且有数据 | 直接使用，**不改动** |
 *
 * 生产不可触达（双防线）：
 * 1. 启动路径（`../server.ts`）仅在 `TWIKOO_SEED=1` 时**动态 import** 本模块；
 * 2. 本模块入口 {@link seedDemoData} 再次校验开关，未开启即抛
 *    {@link SeedNotAllowedError}——即使被误调用也不会写入任何数据。
 */
import type { Database } from "@twikoojs/common";
import {
  DEMO_CONFIG,
  DEMO_SCENARIOS,
  DEMO_URL,
  DEMO_VISITORS,
  OTHER_URL,
  buildDemoComments,
} from "./fixtures";

/** seed 开关环境变量名（`TWIKOO_SEED=1` 或 `pnpm demo`）*/
export const SEED_ENV_KEY = "TWIKOO_SEED";

/** seed 开关值（1 视为开启） */
export const SEED_ENV_VALUE = "1";

/** seed 结果（供日志与单测断言） */
export interface SeedResult {
  /** 本次是否实际写入数据（false = 已有数据，未改动） */
  seeded: boolean;
  /** 写入的评论条数 */
  comments: number;
  /** 写入/沿用的访客计数（`/demo.html`） */
  visitors: number;
  /** 人读原因（写入/跳过） */
  reason: string;
}

/** 生产误触达错误（未开启 seed 却调用即抛，绝不静默写入）*/
export class SeedNotAllowedError extends Error {
  /**
   * @param envKey 开关环境变量名
   */
  constructor(envKey: string) {
    super(
      `demo seed 未开启：仅当 ${envKey}=1 时允许执行（生产环境请勿设置该变量）。` +
        "本次调用未写入任何数据。",
    );
    this.name = "SeedNotAllowedError";
  }
}

/**
 * 判断 seed 是否开启（缺省读进程环境变量；显式传 env 便于单测）。
 * @param env 环境变量表（缺省 `process.env`）
 * @returns true 表示允许执行 seed
 */
export function isSeedEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SEED_ENV_KEY] === SEED_ENV_VALUE;
}

/** seed 选项 */
export interface SeedOptions {
  /** 目标数据库（已由适配器按 MONGODB_URI / TWIKOO_DATA 选定） */
  database: Database;
  /** 环境变量表（缺省 `process.env`） */
  env?: NodeJS.ProcessEnv;
  /** 日志输出（缺省 `console.log`；测试可注入收集器） */
  log?: (message: string) => void;
}

/**
 * 写入 demo 测试数据。已有评论时**不改动**任何数据。
 * @param options seed 选项
 * @returns seed 结果
 */
export async function seedDemoData(options: SeedOptions): Promise<SeedResult> {
  const { database } = options;
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.log(message));
  if (!isSeedEnabled(env)) throw new SeedNotAllowedError(SEED_ENV_KEY);

  await database.init();

  /** 三态检测：任何已有评论都视为「有数据」→ 直接使用不改动 */
  const existing = await database.countComments({});
  if (existing > 0) {
    const counter = await database.getCounter(DEMO_URL);
    const visitors = counter?.time ?? 0;
    const reason = `已存在 ${existing} 条评论，跳过 seed（不改动现有数据）`;
    log(`[twikoo-seed] ${reason}`);
    return { seeded: false, comments: existing, visitors, reason };
  }

  /** 顶级评论先写（拿回 `_id`），回复再按 ref 解析 pid/rid —— 与 1.x 提交链路同序 */
  const fixtures = buildDemoComments(Date.now());
  /** ref → 真实 `_id` */
  const idByRef = new Map<string, string>();
  /** 已写入条数 */
  let written = 0;

  for (const fixture of fixtures) {
    if (fixture.pidRef !== undefined) continue;
    const { ref, pidRef, ridRef, ...doc } = fixture;
    void pidRef;
    void ridRef;
    const saved = await database.addComment(doc);
    if (ref !== undefined && saved._id !== undefined) idByRef.set(ref, saved._id);
    written += 1;
  }
  for (const fixture of fixtures) {
    if (fixture.pidRef === undefined) continue;
    const { ref, pidRef, ridRef, ...doc } = fixture;
    const pid = idByRef.get(pidRef) ?? "";
    const rid = ridRef !== undefined ? (idByRef.get(ridRef) ?? "") : "";
    const saved = await database.addComment({ ...doc, pid, rid });
    if (ref !== undefined && saved._id !== undefined) idByRef.set(ref, saved._id);
    written += 1;
  }

  /** 场景 11：默认配置对象（配置面板全部字段有值） */
  await database.saveConfig(DEMO_CONFIG);

  /** 场景 10：访客计数（1.x 只有 incCounter 自增语义，故循环写入） */
  for (let i = 0; i < DEMO_VISITORS; i += 1) await database.incCounter(DEMO_URL, "Twikoo Demo");
  for (let i = 0; i < 3; i += 1) await database.incCounter(OTHER_URL, "Twikoo Demo 第二页");

  const reason = `已生成 ${written} 条测试评论（覆盖 ${DEMO_SCENARIOS.length} 项场景），配置 ${Object.keys(DEMO_CONFIG).length} 项，访客计数 ${DEMO_VISITORS}`;
  log(`[twikoo-seed] ${reason}`);
  return { seeded: true, comments: written, visitors: DEMO_VISITORS, reason };
}

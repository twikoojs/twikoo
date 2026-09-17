/**
 * 客户端日志器（§8.3：`logger` 分级 + `TWIKOO_LOG_LEVEL`）。
 *
 * 独立成模块（而非放在 `utils/index.ts`）：`emotion.ts` / `highlight.ts` 等子模块
 * 需要日志能力，若从 `index.ts` 取则会形成 `index ↔ 子模块` 循环依赖——ESM 下虽然
 * 只在函数体内使用不会立即报错，但属于脆弱结构，2.0 起显式打散。
 */

/** 日志级别数值表（越大越严重） */
const LOG_LEVEL: Record<string, number> = { verbose: 1, info: 2, warn: 3, error: 4 };

/** 日志级别读取（浏览器产物由 Vite define 注入；Node 测试环境走 process） */
const envLogLevel: string =
  typeof process !== "undefined" && process.env
    ? String(process.env.TWIKOO_LOG_LEVEL || "info")
    : "info";

/** 当前生效级别 */
const currentLevel = LOG_LEVEL[envLogLevel.toLowerCase()] || 2;

/** 客户端日志器（console 输出，级别过滤） */
export const logger = {
  /** verbose 级 */
  verbose: (...m: unknown[]): void => {
    if (currentLevel <= 1) console.log(...m);
  },
  /** info 级 */
  info: (...m: unknown[]): void => {
    if (currentLevel <= 2) console.info(...m);
  },
  /** warn 级 */
  warn: (...m: unknown[]): void => {
    if (currentLevel <= 3) console.warn(...m);
  },
  /** error 级 */
  error: (...m: unknown[]): void => {
    if (currentLevel <= 4) console.error(...m);
  },
};

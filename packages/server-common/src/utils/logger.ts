/**
 * 日志工具（1.7.24 `twikoo-func/utils/logger.js` 语义对齐 + §8.3 改进）。
 *
 * 保留：verbose/info/warn/error 四级，级别由 TWIKOO_LOG_LEVEL 控制（默认 info）。
 * 改进（§8.3）：每请求一个 {@link RequestLogger} 实例——
 * - 控制台输出带 requestId 前缀，前端排障可拿 ID 到后端日志检索；
 * - 聚合本次请求全部日志行（getText()），pipeline 在异常响应体中回传 `log` 字段，
 *   供前端错误卡片（T33 TkError）与管理面板展示。
 */
import { randomUUID } from "node:crypto";

let envLogLevel = process.env.TWIKOO_LOG_LEVEL || "info";
envLogLevel = envLogLevel.toLowerCase();

/** 级别权重：verbose(1) 最详尽，error(4) 只报错；数值 ≤ 当前级别才输出（1.x 语义） */
const logLevel: Record<string, number> = { verbose: 1, info: 2, warn: 3, error: 4 };

/** 当前生效级别（未识别值回落 info，1.x 语义） */
const currentLevel = logLevel[envLogLevel] || 2;

/** 任意日志参数（Error / 对象 / 标量混合） */
export type LogMessage = unknown;

/**
 * 请求级日志器：pipeline 为每个请求创建一个，注入 {@link PipelineContext} 供
 * handlers 沿用；getText() 供异常路径聚合回传。
 */
export interface RequestLogger {
  /** verbose 级（级别 1，默认关闭） */
  verbose(...messages: LogMessage[]): void;
  /** info 级（级别 2，默认开启） */
  info(...messages: LogMessage[]): void;
  /** warn 级（级别 3） */
  warn(...messages: LogMessage[]): void;
  /** error 级（级别 4） */
  error(...messages: LogMessage[]): void;
  /** 获取本次请求聚合的全部日志行（每行一条，含时间与 requestId） */
  getText(): string;
  /** 本次请求的 requestId（与日志行前缀一致） */
  readonly requestId: string;
}

/**
 * 单条日志参数格式化：Error 取 message（含堆栈太长），对象 best-effort JSON，
 * 其余 String()。
 * @param message 单个日志参数
 * @returns 可读字符串
 */
function formatMessage(message: LogMessage): string {
  if (message instanceof Error) return message.message;
  if (typeof message === "string") return message;
  if (typeof message === "object" && message !== null) {
    try {
      return JSON.stringify(message);
    } catch {
      // 循环引用等不可序列化对象：只标注类型，不再尝试字符串化
      return "[unserializable]";
    }
  }
  return String(message);
}

/**
 * 创建请求级日志器（§8.3：requestId 贯穿全链路）。
 * @param requestId 请求 ID（不传则自动生成 UUID）
 * @returns 请求级日志器实例
 */
export function createRequestLogger(requestId: string = randomUUID()): RequestLogger {
  /** 聚合缓冲：记录全部级别（控制台按级别过滤，缓冲不过滤——异常诊断需要完整上下文） */
  const lines: string[] = [];

  /**
   * 统一写入口：级别够则输出控制台，任何级别都进缓冲。
   * @param level 级别名
   * @param weight 级别权重
   * @param consoleFn 控制台输出函数（console.log/info/warn/error）
   * @param messages 日志参数
   */
  const write = (
    level: string,
    weight: number,
    consoleFn: (...args: unknown[]) => void,
    messages: LogMessage[],
  ): void => {
    const text = messages.map(formatMessage).join(" ");
    const line = `${new Date().toLocaleString()} Twikoo:[${requestId}] ${text}`;
    lines.push(line);
    if (currentLevel <= weight) consoleFn(line);
  };

  /** verbose 输出 */
  const verbose = (...messages: LogMessage[]): void => write("verbose", 1, console.log, messages);
  /** info 输出 */
  const info = (...messages: LogMessage[]): void => write("info", 2, console.info, messages);
  /** warn 输出 */
  const warn = (...messages: LogMessage[]): void => write("warn", 3, console.warn, messages);
  /** error 输出 */
  const error = (...messages: LogMessage[]): void => write("error", 4, console.error, messages);

  /** 读取聚合文本 */
  const getText = (): string => lines.join("\n");

  return { verbose, info, warn, error, getText, requestId };
}

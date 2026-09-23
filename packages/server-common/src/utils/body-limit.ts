/**
 * Node HTTP 请求体读取（**累计字节上限 + 读取超时**）。
 *
 * 为什么必须放在公共库：自托管（tkserver）适配器需要手工把
 * `IncomingMessage` 读成字符串再 `JSON.parse`。若把「读全流 → Buffer.concat →
 * 解码 → JSON.parse」原样执行，攻击者无需登录即可提交超大请求体，在**限流生效
 * 之前**就吃掉内存与 CPU（图片服务内部的 10 MB 限制保护不到这里——进图片校验
 * 前请求体已被读完）。1.x 时期各平台各写一遍、实现发散，故 2.0 收敛到这里
 * （GHSA-v349-m8q5-7x2g）。
 *
 * 两个上限都必需，缺一不可：
 * - **累计字节**：`Content-Length` 是客户端自报值，可缺失、可撒谎，只能当快速
 *   拒绝的预检，真正的兜底是边读边累加；
 * - **读取耗时**：慢速发送（slowloris）可以既不超字节数也不结束流。
 */
import { Buffer } from "node:buffer";

/** 请求体默认上限：16 MiB */
export const DEFAULT_MAX_BODY_BYTES = 16 * 1024 * 1024;

/**
 * 默认上限的取值依据：`UPLOAD_IMAGE` 的图片载荷走 base64 data URL 放在请求体里，
 * 而图片本身的内部上限是 10 MB，base64 后约 13.98 MB —— 16 MiB 留有余量。
 * 更大的合法载荷（如 `COMMENT_IMPORT_FOR_ADMIN` 导入大站评论）用
 * `TWIKOO_MAX_BODY_BYTES` 放宽。
 */
export const DEFAULT_BODY_READ_TIMEOUT_MS = 15000;

/** 请求体超限（调用方应回 413） */
export class BodyTooLargeError extends Error {
  /** 实际（或声明）字节数 */
  readonly actualBytes: number;
  /** 生效的上限 */
  readonly limitBytes: number;

  /**
   * @param actualBytes 实际（或声明）字节数
   * @param limitBytes 生效的上限
   */
  constructor(actualBytes: number, limitBytes: number) {
    super(`请求体超过上限：${actualBytes} > ${limitBytes} 字节`);
    this.name = "BodyTooLargeError";
    this.actualBytes = actualBytes;
    this.limitBytes = limitBytes;
  }
}

/** 请求体读取超时（调用方应回 408） */
export class BodyReadTimeoutError extends Error {
  /** 超时毫秒数 */
  readonly timeoutMs: number;

  /**
   * @param timeoutMs 超时毫秒数
   */
  constructor(timeoutMs: number) {
    super(`请求体读取超时：${timeoutMs}ms`);
    this.name = "BodyReadTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** 可读请求流的最小结构面（`IncomingMessage` 满足；异步可迭代 + 请求头） */
export interface ReadableRequestBodyLike extends AsyncIterable<Uint8Array> {
  /** 请求头（仅用于 `Content-Length` 快速拒绝） */
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * 解析生效的请求体上限（`TWIKOO_MAX_BODY_BYTES` 覆盖；非法值回退默认）。
 * @returns 上限字节数
 */
export function resolveMaxBodyBytes(): number {
  return resolvePositiveInt("TWIKOO_MAX_BODY_BYTES", DEFAULT_MAX_BODY_BYTES);
}

/**
 * 解析生效的读取超时（`TWIKOO_BODY_TIMEOUT_MS` 覆盖；非法值回退默认）。
 * @returns 超时毫秒数
 */
export function resolveBodyTimeoutMs(): number {
  return resolvePositiveInt("TWIKOO_BODY_TIMEOUT_MS", DEFAULT_BODY_READ_TIMEOUT_MS);
}

/**
 * 读取正整数环境变量（缺失/非法/非正数回退默认）。
 * @param name 环境变量名
 * @param fallback 默认值
 * @returns 生效值
 */
function resolvePositiveInt(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * 读取 `Content-Length` 声明值（缺失/非法返回 0）。
 * @param req 请求流
 * @returns 声明字节数；无有效声明时为 0
 */
function declaredLength(req: ReadableRequestBodyLike): number {
  const raw = req.headers?.["content-length"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * 读取请求体文本（累计字节上限 + 读取超时）。
 *
 * 超限时**立即停止读取**并抛 {@link BodyTooLargeError}，不再消费剩余流；
 * 超时抛 {@link BodyReadTimeoutError}。两者都由调用方转成 413 / 408。
 * @param req 请求流
 * @param options 覆盖项（测试用；缺省读环境变量与默认值）
 * @returns 请求体文本（UTF-8 解码）
 */
export async function readBodyWithLimit(
  req: ReadableRequestBodyLike,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<string> {
  const limit = options.maxBytes ?? resolveMaxBodyBytes();
  const timeoutMs = options.timeoutMs ?? resolveBodyTimeoutMs();
  // 快速拒绝：声明值已超限就不必读流。仅为优化，兜底仍是下面的累计检查。
  const declared = declaredLength(req);
  if (declared > limit) throw new BodyTooLargeError(declared, limit);

  const chunks: Buffer[] = [];
  let total = 0;
  const deadline = Date.now() + timeoutMs;
  const iterator = req[Symbol.asyncIterator]();
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new BodyReadTimeoutError(timeoutMs);
    /** 单次读取的计时器（读取完成即清，避免拖住事件循环） */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), remaining);
    });
    let step: IteratorResult<Uint8Array> | "timeout";
    try {
      step = await Promise.race([iterator.next(), timeout]);
    } finally {
      clearTimeout(timer);
    }
    if (step === "timeout") throw new BodyReadTimeoutError(timeoutMs);
    if (step.done) break;
    const chunk = Buffer.from(step.value);
    total += chunk.length;
    if (total > limit) throw new BodyTooLargeError(total, limit);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

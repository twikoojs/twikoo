/**
 * twikoo-func 主逻辑（CloudBase 薄适配器，规范 §6.6）。
 * 业务逻辑全部在 @twikoojs/common；平台核对（§6.8）：docs.cloudbase.net 云函数章节（查阅 2026-09-17）。
 */
import {
  Capabilities,
  CloudBaseDatabase,
  createHandler,
  defineCapabilities,
  type CloudBaseDatabaseLike,
  type TkRequest,
  type TkResponse,
} from "@twikoojs/common";

/** CloudBase 平台能力：全能力（§6.5 能力矩阵） */
const cloudbaseCapabilities: Capabilities = defineCapabilities({
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: true,
  qqAvatar: true,
  ai: true,
});

/**
 * CloudBase 事件 → 内部统一请求（1.x 语义：事件本身即请求体；IP 取网关注入头）。
 * @param event 云函数事件
 * @returns 内部统一请求
 */
export function toTkRequest(event: unknown): TkRequest {
  const raw = (event && typeof event === "object" ? event : {}) as Record<string, unknown>;
  const headers = (raw.headers ?? {}) as Record<string, string>;
  const lowerHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    lowerHeaders[key.toLowerCase()] = String(value);
  }
  const forwarded = lowerHeaders["x-forwarded-for"];
  const sourceIp = (raw.requestContext as { http?: { sourceIp?: string } } | undefined)?.http
    ?.sourceIp;
  const ip =
    lowerHeaders["x-real-ip"] ??
    (forwarded ? forwarded.split(",")[0].trim() : "") ??
    sourceIp ??
    "";
  // 事件本身即请求体（1.x 语义）
  const body = raw as TkRequest["body"];
  return { method: "POST", path: "/", query: {}, body, headers: lowerHeaders, ip, raw: event };
}

/** 内部统一响应 → 云函数返回体（网关层承载状态码/CORS）。 */

/** 内部统一响应 → 云函数返回体（网关层承载状态码/CORS）。 */
export function fromTkResponse(response: TkResponse): Record<string, unknown> {
  return response.body;
}

/**
 * 创建 CloudBase 请求处理器（database 可注入供测试；缺省懒加载 TCB SDK）。
 * @param options 注入项
 * @returns 逐请求处理器
 */
export function createTwikooFunc(
  options: { database?: CloudBaseDatabaseLike } = {},
): (event: unknown) => Promise<Record<string, unknown>> {
  let database: CloudBaseDatabaseLike | null = options.database ?? null;
  let sdkPromise: Promise<CloudBaseDatabaseLike> | null = null;
  /** 注入优先；否则动态加载 @cloudbase/node-sdk（SYMBOL_CURRENT_ENV） */
  const getDatabase = async (): Promise<CloudBaseDatabaseLike> => {
    if (database) return database;
    sdkPromise ??= (async () => {
      const specifier = "@cloudbase/node-sdk";
      const tcb = (await import(/* @vite-ignore */ specifier)) as unknown as {
        SYMBOL_CURRENT_ENV: symbol;
        init(options: { env: symbol }): { database(): CloudBaseDatabaseLike };
      };
      return tcb.init({ env: tcb.SYMBOL_CURRENT_ENV }).database();
    })();
    database = await sdkPromise;
    return database;
  };
  return async (event: unknown) => {
    const request = toTkRequest(event);
    const db = await getDatabase();
    const handler = createHandler({
      request: {
        /**
         *
         */
        toTkRequest: () => request,
      },
      response: { fromTkResponse },
      database: new CloudBaseDatabase({ database: db }),
      storage: { challenges: {} as never, tokens: {} as never },
      mailer: {
        /**
         *
         */
        send: async () => {},
      },
      notifier: {
        /**
         *
         */
        notify: async () => {},
      },
      capabilities: cloudbaseCapabilities,
    });
    return fromTkResponse(await handler(request));
  };
}

/** 装配缓存（main 懒加载语义） */
let mainFn: ((event: unknown) => Promise<Record<string, unknown>>) | null = null;

/** CloudBase 云函数入口（exports.main 导出名硬约束，D-22）。 */

/** 云函数入口（exports.main 导出名硬约束，D-22）。 */
export async function main(event: unknown): Promise<Record<string, unknown>> {
  mainFn ??= createTwikooFunc();
  return mainFn(event);
}

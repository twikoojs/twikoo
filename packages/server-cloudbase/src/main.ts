/**
 * twikoo-func 主逻辑（CloudBase 薄适配器，规范 §6.6）。
 * 业务逻辑全部在 @twikoojs/common；平台核对（§6.8）：docs.cloudbase.net 云函数章节（查阅 2026-09-17）。
 *
 * 载荷转换见 `./transform.ts`，后置副作用派发见 `./dispatch.ts`，
 * 平台 SDK 结构面见 `./types.ts`。
 */
import {
  Capabilities,
  CloudBaseDatabase,
  createHandler,
  defineCapabilities,
  type CloudBaseDatabaseLike,
} from "@twikoojs/common";
import { fromTkResponse, toTkRequest } from "./transform";
import { createCloudBaseDispatcher } from "./dispatch";
import type { TcbAppLike, TcbContextLike, TcbSdkStatic } from "./types";

export { fromTkResponse, toTkRequest } from "./transform";

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
 * 创建 CloudBase 请求处理器（database / app 可注入供测试；缺省懒加载 TCB SDK）。
 * @param options 注入项
 * @returns 逐请求处理器（第二参数为云函数上下文，供 IP 解析与递归自调用取函数名）
 */
export function createTwikooFunc(
  options: { database?: CloudBaseDatabaseLike; app?: TcbAppLike } = {},
): (event: unknown, context?: TcbContextLike) => Promise<Record<string, unknown>> {
  let app: TcbAppLike | null = options.app ?? null;
  let database: CloudBaseDatabaseLike | null = options.database ?? null;
  let sdkPromise: Promise<TcbAppLike> | null = null;
  /** 注入优先；否则动态加载 @cloudbase/node-sdk（SYMBOL_CURRENT_ENV） */
  const getApp = async (): Promise<TcbAppLike> => {
    if (app) return app;
    sdkPromise ??= (async () => {
      const specifier = "@cloudbase/node-sdk";
      // v3 起 ESM 命名导出不可用（命名空间仅 default/module.exports/version），
      // 统一回退取 default，兼容 v2 具名与 v3 default 两种形态。
      const mod = (await import(/* @vite-ignore */ specifier)) as unknown as {
        default?: TcbSdkStatic;
      } & TcbSdkStatic;
      const tcb: TcbSdkStatic = mod.default ?? mod;
      return tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
    })();
    app = await sdkPromise;
    return app;
  };
  /** 数据库实例（注入优先，否则取 app 的 database()） */
  const getDatabase = async (): Promise<CloudBaseDatabaseLike> => {
    database ??= (await getApp()).database();
    return database;
  };
  return async (event: unknown, context?: TcbContextLike) => {
    const request = toTkRequest(event, context);
    const db = await getDatabase();
    const handler = createHandler({
      request: {
        /** 事件已在上游转换为统一请求 */
        toTkRequest: () => request,
      },
      response: { fromTkResponse },
      database: new CloudBaseDatabase({ database: db }),
      storage: { challenges: {} as never, tokens: {} as never },
      mailer: {
        /** CloudBase 侧不直发邮件（由 common 内部按需处理） */
        send: async () => {},
      },
      notifier: {
        /** CloudBase 侧不直发推送（由 common 内部按需处理） */
        notify: async () => {},
      },
      postSubmit: createCloudBaseDispatcher(await getApp(), context),
      capabilities: cloudbaseCapabilities,
    });
    return fromTkResponse(await handler(request));
  };
}

/** 装配缓存（main 懒加载语义） */
let mainFn:
  ((event: unknown, context?: TcbContextLike) => Promise<Record<string, unknown>>) | null = null;

/**
 * 云函数入口（exports.main 导出名硬约束，D-22）。
 * @param event 云函数事件
 * @param context 云函数上下文（IP 解析 + 递归自调用取 function_name）
 * @returns 云函数返回体
 */
export async function main(
  event: unknown,
  context?: TcbContextLike,
): Promise<Record<string, unknown>> {
  mainFn ??= createTwikooFunc();
  return mainFn(event, context);
}

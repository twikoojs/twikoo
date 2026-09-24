/**
 * twikoo-func 主逻辑（CloudBase 薄适配器）。
 * 业务逻辑全部在 @twikoojs/common；平台核对：docs.cloudbase.net 云函数章节（查阅 2026-09-17、
 * 真机复核 2026-09-24：运行环境 Node.js 20.19 可在线装依赖，24.11（公测中）不可）。
 *
 * 载荷转换见 `./transform.ts`，后置副作用派发见 `./dispatch.ts`，
 * 平台 SDK 结构面见 `./types.ts`。
 */
import * as tcbSdkNamespace from "@cloudbase/node-sdk";
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

/** CloudBase 平台能力：全能力*/
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
 * `@cloudbase/node-sdk` 的静态形态。
 *
 * **为什么是模块顶层静态 import，而不是调用内 `await import()`**：SDK 的模块加载在冷实例上
 * 约 2.4s（本地对照：`require` 203ms / `init` 18ms，即开销几乎全在加载），而**调用内**的耗时
 * 会算进函数执行时长、直接挤占「执行超时」预算。实测（2026-09-24，免费体验版
 * `GET_FUNC_VERSION`）：冷调用 **2477ms**、同实例后续调用 **66~85ms**；把加载与 `init()`
 * 一并提到模块初始化阶段后，冷调用 **222ms**、`InitFunction` 112ms → 606ms —— 即这 2.4s
 * 从「执行时长」挪进了「初始化时长」。CloudBase 免费体验版/个人版的执行超时**固定 3 秒且
 * 不可修改**（见 `docs/backend.md`），这 2.4s 是决定性的。
 *
 * `@cloudbase/node-sdk` 不在 AGENTS.md「重依赖清单」内，且在 `dependencies` 中，
 * 故静态导入合规（构建侧 `deps.neverBundle` 保证它仍是 external，不进产物）。
 *
 * v3 起 ESM 命名导出不可用（命名空间仅 default/module.exports/version），
 * 统一回退取 default，兼容 v2 具名与 v3 default 两种形态。
 */
const tcbSdk: TcbSdkStatic = (() => {
  const mod = tcbSdkNamespace as unknown as { default?: TcbSdkStatic } & TcbSdkStatic;
  return mod.default ?? mod;
})();

/**
 * 模块级 app 单例（在**实例初始化阶段**构造）。
 *
 * 与 SDK 的官方写法一致（`const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })` 置于模块顶层），
 * 好处同样是让 `init()` 的耗时落在初始化阶段而非执行阶段。
 *
 * 构造失败（例如在云函数环境之外被加载）时回落为 `null`，由首次调用兜底构造 ——
 * 这样本地测试与注入路径（`options.app`）都不受影响。
 */
const sharedApp: TcbAppLike | null = (() => {
  try {
    return tcbSdk.init({ env: tcbSdk.SYMBOL_CURRENT_ENV });
  } catch {
    return null;
  }
})();

/**
 * 创建 CloudBase 请求处理器（database / app 可注入供测试；缺省用模块级单例）。
 * @param options 注入项
 * @returns 逐请求处理器（第二参数为云函数上下文，供 IP 解析与递归自调用取函数名）
 */
export function createTwikooFunc(
  options: { database?: CloudBaseDatabaseLike; app?: TcbAppLike } = {},
): (event: unknown, context?: TcbContextLike) => Promise<Record<string, unknown>> {
  let app: TcbAppLike | null = options.app ?? sharedApp;
  let database: CloudBaseDatabaseLike | null = options.database ?? null;
  /**
   * 取 app：注入优先 → 模块级单例 → 兜底构造。
   * 只有模块级构造失败（`sharedApp === null`）才会走到最后一步。
   * @returns CloudBase app 实例
   */
  const getApp = (): TcbAppLike => {
    app ??= tcbSdk.init({ env: tcbSdk.SYMBOL_CURRENT_ENV });
    return app;
  };
  /**
   * 数据库实例（注入优先，否则取 app 的 `database()`）。
   * app 已在初始化阶段就绪，故这里只是一次廉价的句柄构造。
   * @returns 数据库句柄
   */
  const getDatabase = (): CloudBaseDatabaseLike => {
    database ??= getApp().database();
    return database;
  };
  return async (event: unknown, context?: TcbContextLike) => {
    const request = toTkRequest(event, context);
    const handler = createHandler({
      request: {
        /** 事件已在上游转换为统一请求 */
        toTkRequest: () => request,
      },
      response: { fromTkResponse },
      database: new CloudBaseDatabase({ database: getDatabase() }),
      storage: { challenges: {} as never, tokens: {} as never },
      mailer: {
        /** CloudBase 侧不直发邮件（由 common 内部按需处理） */
        send: async () => {},
      },
      notifier: {
        /** CloudBase 侧不直发推送（由 common 内部按需处理） */
        notify: async () => {},
      },
      postSubmit: createCloudBaseDispatcher(getApp(), context),
      capabilities: cloudbaseCapabilities,
    });
    return fromTkResponse(await handler(request));
  };
}

/** 装配缓存（main 懒加载语义） */
let mainFn:
  ((event: unknown, context?: TcbContextLike) => Promise<Record<string, unknown>>) | null = null;

/**
 * 云函数入口（exports.main 导出名硬约束）。
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

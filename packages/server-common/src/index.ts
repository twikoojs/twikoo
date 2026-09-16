/**
 * `@twikoojs/common` 唯一入口（规范 §6.2「唯一入口：createHandler(adapters) → handleRequest」）。
 *
 * 导出全部 ports 契约与统一入口 {@link createHandler}。适配器只做
 * 「入口 + 适配器注入」（注入 {@link TkAdapters}，每个适配器目标 < 150 行），
 * 全部业务逻辑（pipeline / dispatcher / handlers）随 T13 / T18 接入。
 */
export * from "./ports/request";
export * from "./ports/response";
export * from "./ports/database";
export * from "./ports/storage";
export * from "./ports/mailer";
export * from "./ports/notifier";
export * from "./ports/capabilities";

// `export *` 只对外转发、不引入本模块作用域——TkAdapters / TwikooHandler 引用的
// 端口名必须显式 import；Storage 尤其必须显式引入，否则会静默解析到 DOM 全局的
// window.Storage（localStorage）类型（实测 TS 不报错而语义全错）。
import type { RequestPort, TkRequest } from "./ports/request";
import type { ResponsePort, TkResponse } from "./ports/response";
import type { Database } from "./ports/database";
import type { Storage } from "./ports/storage";
import type { Mailer } from "./ports/mailer";
import type { Notifier } from "./ports/notifier";
import type { Capabilities } from "./ports/capabilities";

/**
 * 适配器聚合端口（§6.2「适配器契约」全集）：
 * 适配器以单一对象向 {@link createHandler} 注入请求/响应转换、数据库、
 * 验证码存储、邮件、通知与平台能力声明。
 */
export interface TkAdapters {
  /** 平台原始载荷 → TkRequest 的转换（toTkRequest，§6.3） */
  request: RequestPort;
  /** TkResponse → 平台返回体的转换（fromTkResponse，§6.3） */
  response: ResponsePort;
  /** 数据库实现（MongoDB / LokiJS / Blob KV / CloudBase 之一，§6.4） */
  database: Database;
  /** Cap 验证码存储（challenges / tokens 双组钩子，§6.2 storage） */
  storage: Storage;
  /** 邮件发送（声明 mail 能力时可用，§6.5） */
  mailer: Mailer;
  /** 通知发送（pushoo / webhook，§6.2 notifier） */
  notifier: Notifier;
  /** 平台能力声明（§6.5 八项能力） */
  capabilities: Capabilities;
}

/** 统一请求处理器签名：入参为已归一化的 {@link TkRequest}，返回内部 {@link TkResponse} */
export type TwikooHandler = (request: TkRequest) => Promise<TkResponse>;

/**
 * 创建统一请求处理器（§6.2 唯一入口：createHandler(adapters) → handleRequest）。
 *
 * 【T13 接缝】本波为计划内接缝：仅冻结入口类型签名与装配形态
 * （启动期调用一次，返回逐请求调用的处理器），handleRequest 在 pipeline
 * 接线前一律抛出既定错误；pipeline（限流 → 校验 → 鉴权 → 连库 → 读配置 →
 * CORS → 分发 → 回填）与 dispatcher 装配由 todo 13 接管并替换实现。
 * @param adapters 适配器聚合端口
 * @returns 统一请求处理器
 */
export function createHandler(adapters: TkAdapters): TwikooHandler {
  // adapters 在装配期注入（T13 前仅保留引用以避免未使用告警）
  void adapters;

  /** 返回的逐请求处理器：T13 前走既定抛错分支 */
  return function handleRequest() {
    return Promise.reject(new Error("pipeline wiring arrives in todo 13"));
  };
}

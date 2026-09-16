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
import { createPipeline } from "./core/pipeline";

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
 * 启动期调用一次完成装配（注入适配器聚合端口），返回的处理器逐请求调用，
 * 内部执行 pipeline 八步编排（限流 → 校验 → 匿名签到 → 连库 → 读配置 →
 * CORS → OPTIONS/分发 → 回填）。
 * @param adapters 适配器聚合端口
 * @returns 统一请求处理器
 */
export function createHandler(adapters: TkAdapters): TwikooHandler {
  /** 返回的逐请求处理器（pipeline 实现） */
  return createPipeline(adapters);
}

// ---- core 层导出（T13）----
// handler / 服务实现经包内相对路径互引；对外只暴露扩展点与复位钩子。
export type { PipelineContext, EventHandler } from "./core/types";
export { RateLimitError, HandlerNotRegisteredError } from "./core/errors";
export { registerHandler, resolveHandler, resetHandlers } from "./core/handler-registry";
export { dispatch } from "./core/dispatcher";
export { resetRequestTimes } from "./core/pipeline";
export type { PostSubmitService } from "./services/post-submit";
export { setPostSubmitService, getPostSubmitService } from "./services/post-submit";
export { RES_CODE, getMaxRequestTimes } from "./utils/constants";
export type { RequestLogger } from "./utils/logger";
export { createRequestLogger } from "./utils/logger";
export { validateClientFields } from "./utils/validate";
// ---- 库加载器（T17，D-2 依赖外部化）----
export type {
  NodemailerLike,
  DOMPurifyLike,
  AxiosLike,
  CustomLibs,
  LibImporter,
} from "./utils/lib-loader";
export {
  CapabilityError,
  LibLoadError,
  defineCapabilities,
  setCustomLibs,
  resetCustomLibs,
  setLibImporter,
  getNodemailer,
  getDomPurify,
  getIpToRegion,
  getAkismetClient,
  getTencentcloudTms,
  getFormData,
  getAxios,
  getXml2js,
  getHtmlToText,
  getBowser,
  getMarked,
} from "./utils/lib-loader";

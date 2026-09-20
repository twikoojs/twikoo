/**
 * pipeline / dispatcher 共享类型（规范 core 层）。
 *
 * 独立成文件避免 pipeline ↔ dispatcher 循环引用：pipeline 创建上下文后调用
 * dispatcher，dispatcher 与 handlers 只消费类型。
 */
import type { ConfigData } from "../ports/database";
import type { TkAdapters, TkRequest, TkResponseBody } from "../index";
import type { RequestLogger } from "../utils/logger";

/**
 * 单次请求的处理上下文：pipeline 八步编排完成后构造，贯穿 dispatcher 与
 * 全部 handlers。字段集对齐 1.x 各 handler 的闭包依赖（db / config /
 * accessToken / request / logger）。
 */
export interface PipelineContext {
  /** 已归一化的内部统一请求 */
  request: TkRequest;
  /** 本次请求 ID（与日志行前缀一致）*/
  requestId: string;
  /** 本次请求的 accessToken（客户端回传，或匿名签到新生成） */
  accessToken: string;
  /** 数据库读取的全量配置（readConfig 后；无配置为空对象） */
  config: ConfigData;
  /** 适配器聚合端口（database / storage / mailer / notifier / capabilities） */
  adapters: TkAdapters;
  /** 请求级日志器（requestId 注入；getText() 可聚合回传） */
  logger: RequestLogger;
}

/**
 * 事件处理器签名：入参为请求上下文，返回响应体（不含 HTTP 状态与 CORS 头——
 * 那两层由 pipeline 统一承载；错误直接抛出，由 pipeline catch 统一转错误体）。
 */
export type EventHandler = (ctx: PipelineContext) => Promise<TkResponseBody> | TkResponseBody;

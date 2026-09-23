/**
 * POST_SUBMIT 派发端口（后置副作用异步语义）。
 *
 * **为什么需要这个端口**：COMMENT_SUBMIT 保存评论之后的副作用链（第三方垃圾
 * 检测 + 邮件/IM 通知）耗时且依赖外部网络，绝不能计入用户请求的执行预算。
 * 否则会有两个后果：
 *   1. 用户提交评论要等整条链跑完，体验极差；
 *   2. 超出云函数的执行时间上限时**整个调用失败**——而评论其实已经入库，
 *      客户端却收到错误，用户重试还会产生重复评论（1.x 时期真实存在此问题）。
 *
 * **为什么必须由适配器实现**：1.x 各平台把副作用移出请求预算的机制并不相同，
 * 且都是平台专有 API：
 *
 * | 平台 | 1.x 机制 |
 * | --- | --- |
 * | vercel / netlify / aws-lambda | HTTP 递归自调用（netlify / aws-lambda 在 1.x 是 `require('twikoo-vercel')` 转发，自动继承） |
 * | CloudBase | `app.callFunction` 递归自调用（`timeout: 300` 实现异步） |
 * | self-hosted | 进程内直调 `postSubmit(comment)`，不 await |
 * | eo-makers | 进程内 `postSubmit(...).catch(...)`，不 await |
 *
 * 副作用链**本身**（垃圾检测 → 回写结果 → 三路通知）仍然统一在 common 的
 * postSubmit 服务里（`services/post-submit.ts`），适配器只负责「如何把这次
 * POST_SUBMIT 送到一个独立执行单元」。
 */
import type { CommentDoc, ConfigData } from "./database";
import type { PipelineContext } from "../core/types";

/**
 * POST_SUBMIT 派发端口：把后置副作用移出当前请求的执行预算。
 *
 * 适配器按平台机制实现；未提供时 `scaffoldAdapters` 给出进程内不等待的
 * 默认实现（等价 1.x self-hosted / eo-makers 行为）。
 */
export interface PostSubmitDispatcher {
  /**
   * 派发 POST_SUBMIT（垃圾检测 + 通知）到独立执行单元。
   *
   * **契约：不等待副作用完成。** resolve 只表示「已成功派出」，不表示副作用
   * 已执行完毕；实现方必须保证副作用不会因当前请求结束而被中断（常驻进程
   * 直接异步执行；单次执行平台递归自调用，让副作用拥有独立的执行预算）。
   *
   * 派发失败（如自调用请求发不出去）应抛出或自行记录，由调用方决定是否
   * 影响 COMMENT_SUBMIT 的返回——调用方按「评论已入库即成功」处理。
   *
   * @param comment 已入库的评论
   * @param ctx 当前请求上下文（进程内派发可直接复用整个 ctx；跨执行单元
   *   派发时自行提取可序列化字段与递归令牌 {@link getRecursionToken}）
   * @returns 派发完成的 Promise（不等待副作用本身）
   */
  dispatch(comment: CommentDoc, ctx: PipelineContext): Promise<void>;
}

/**
 * 内部派发令牌（1.x `x-twikoo-recursion` 头语义）。
 *
 * 派发方向目标执行单元带上此令牌，目标侧的 POST_SUBMIT 事件处理器据此
 * 拒绝**外部**直接调用（否则任何人都能凭空触发垃圾检测与通知）。
 * 1.x 的取值即 `config.ADMIN_PASS || "true"`。
 * @param config 全量配置
 * @returns 令牌字符串
 */
export function getRecursionToken(config: ConfigData): string {
  return String(config.ADMIN_PASS || "true");
}

/** 内部派发令牌的请求头名（1.x 同名，跨版本可互认） */
export const RECURSION_HEADER = "x-twikoo-recursion";

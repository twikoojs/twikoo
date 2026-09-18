/**
 * 适配器脚手架（规范 §6.2 适配器契约的装配帮手，T21 起供各薄适配器复用）。
 *
 * storage / mailer / notifier 三个槽位以空实现占位：真实的邮件/通知/Cap
 * 存储均由 services 层经 lib-loader（能力门 + setCustomLibs + 动态 import）
 * 装载，不走这三个端口槽位（T18 实现记录）；槽位保留以冻结 TkAdapters
 * 端口形态（未来平台原生实现可从注入点接入）。
 *
 * `postSubmit` 槽位给出**进程内不等待**的默认实现——单次执行平台
 * （cloudbase / vercel / netlify / aws-lambda）必须自行注入递归自调用的
 * 派发端口，否则响应返回后实例被冻结，副作用可能被中断。
 */
import type { Capabilities } from "../ports/capabilities";
import type { Database } from "../ports/database";
import type { Mailer } from "../ports/mailer";
import type { Notifier } from "../ports/notifier";
import type { Storage } from "../ports/storage";
import type { RequestPort } from "../ports/request";
import type { ResponsePort } from "../ports/response";
import type { PostSubmitDispatcher } from "../ports/post-submit";
import { getPostSubmitService } from "../services/post-submit";
import type { TkAdapters } from "../index";

/** 空操作异步函数（占位槽位通用实现） */
const noop = async (): Promise<void> => {};

/** 无 challenge 读取（Promise 包装满足端口形态） */
const noChallenge = (): Promise<null> => Promise.resolve(null);

/** 无 token 过期读取（Promise 包装满足端口形态） */
const noExpiry = (): Promise<null> => Promise.resolve(null);

/**
 * 默认派发实现：进程内直调 postSubmit 服务，**不等待**完成
 * （等价 1.x self-hosted `postSubmit(comment)` 与 eo-makers
 * `postSubmit(...).catch(...)` 的行为）。
 *
 * 仅适用于常驻进程平台；单次执行平台须注入自己的递归自调用实现。
 */
const inProcessDispatcher: PostSubmitDispatcher = {
  /**
   * 进程内派发：立即返回，副作用在后台继续。
   * @param comment 已入库的评论
   * @param ctx 当前请求上下文
   */
  dispatch(comment, ctx): Promise<void> {
    void getPostSubmitService()(comment, ctx).catch((e: unknown) => {
      ctx.logger.error("POST_SUBMIT 失败", e instanceof Error ? e.message : String(e));
    });
    // 立即 resolve：契约要求「不等待副作用完成」，副作用在后台继续
    return Promise.resolve();
  },
};

/**
 * 组装 TkAdapters（request/response/database/capabilities 必填，
 * storage/mailer/notifier 空实现占位，postSubmit 可用 postSubmit 覆写）。
 * @param options 必填四项 + 可选的平台派发实现
 * @returns 适配器聚合
 */
export function scaffoldAdapters(options: {
  /** 平台事件 → TkRequest 转换 */
  request: RequestPort;
  /** TkResponse → 平台返回体转换 */
  response: ResponsePort;
  /** 数据库实现 */
  database: Database;
  /** 平台能力声明 */
  capabilities: Capabilities;
  /**
   * 后置副作用派发实现（§6.6）。缺省为进程内不等待——单次执行平台
   * 必须显式传入递归自调用实现（见 {@link PostSubmitDispatcher}）。
   */
  postSubmit?: PostSubmitDispatcher;
}): TkAdapters {
  /** 占位 Cap 存储（读取恒 null，其余空操作） */
  const storage: Storage = {
    challenges: {
      store: noop,
      read: noChallenge,
      delete: noop,
      deleteExpired: noop,
    },
    tokens: {
      store: noop,
      get: noExpiry,
      delete: noop,
      deleteExpired: noop,
    },
  };
  /** 占位邮件发送 */
  const mailer: Mailer = { send: noop };
  /** 占位通知发送 */
  const notifier: Notifier = { notify: noop };
  return {
    request: options.request,
    response: options.response,
    database: options.database,
    storage,
    mailer,
    notifier,
    postSubmit: options.postSubmit ?? inProcessDispatcher,
    capabilities: options.capabilities,
  };
}

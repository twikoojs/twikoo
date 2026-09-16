/**
 * 适配器脚手架（规范 §6.2 适配器契约的装配帮手，T21 起供各薄适配器复用）。
 *
 * storage / mailer / notifier 三个槽位以空实现占位：真实的邮件/通知/Cap
 * 存储均由 services 层经 lib-loader（能力门 + setCustomLibs + 动态 import）
 * 装载，不走这三个端口槽位（T18 实现记录）；槽位保留以冻结 TkAdapters
 * 端口形态（未来平台原生实现可从注入点接入）。
 */
import type { Capabilities } from "../ports/capabilities";
import type { Database } from "../ports/database";
import type { Mailer } from "../ports/mailer";
import type { Notifier } from "../ports/notifier";
import type { Storage } from "../ports/storage";
import type { RequestPort } from "../ports/request";
import type { ResponsePort } from "../ports/response";
import type { TkAdapters } from "../index";

/** 空操作异步函数（占位槽位通用实现） */
const noop = async (): Promise<void> => {};

/** 无 challenge 读取（Promise 包装满足端口形态） */
const noChallenge = (): Promise<null> => Promise.resolve(null);

/** 无 token 过期读取（Promise 包装满足端口形态） */
const noExpiry = (): Promise<null> => Promise.resolve(null);

/**
 * 组装 TkAdapters（request/response/database/capabilities 必填，
 * storage/mailer/notifier 空实现占位）。
 * @param options 必填四项
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
    capabilities: options.capabilities,
  };
}

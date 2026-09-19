/**
 * SET_CONFIG 事件处理器（1.x setConfig 语义对齐）。
 */
import type { ConfigData } from "../ports/database";
import type { EventHandler } from "../core/types";
import { setConfig } from "../services/config";
import { isAdmin } from "../services/user";

/**
 * 修改配置（管理员写入库；saveConfig 合并语义）。
 * @param ctx 请求上下文
 * @returns 设置响应
 */
export const setConfigEvent: EventHandler = (ctx) =>
  setConfig({
    newConfig: ctx.request.body.config as ConfigData,
    isAdminUser: isAdmin(ctx.config, ctx.accessToken),
    /**
     *
     */
    saveConfig: (config) => ctx.adapters.database.saveConfig(config),
  });

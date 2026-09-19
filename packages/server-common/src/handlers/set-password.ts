/**
 * SET_PASSWORD 事件处理器（1.x setPassword 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { setPassword } from "../services/user";

/**
 * 写入管理密码（库中无密码可直接写入；已有密码需管理员）。
 * @param ctx 请求上下文
 * @returns 设置响应
 */
export const setPasswordEvent: EventHandler = (ctx) =>
  setPassword({
    config: ctx.config,
    accessToken: ctx.accessToken,
    password: ctx.request.body.password,
    /**
     *
     */
    saveConfig: (config) => ctx.adapters.database.saveConfig(config),
  });

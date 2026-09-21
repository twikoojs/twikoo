/**
 * CONFIG_EXPORT_FOR_ADMIN 事件处理器：导出配置。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { isAdmin } from "../services/user";
import type { ConfigData } from "../ports/database";

/**
 * 管理员导出配置（排除 CREDENTIALS）。
 * @param ctx 请求上下文
 * @returns 导出响应（config 为全量配置）
 */
export const configExportForAdmin: EventHandler = (ctx) => {
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  const safeConfig: ConfigData = { ...ctx.config };
  // 排除 CREDENTIALS（包含敏感信息）
  delete safeConfig.CREDENTIALS;
  return { code: RES_CODE.SUCCESS, config: safeConfig };
};

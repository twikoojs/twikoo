/**
 * CONFIG_IMPORT_FOR_ADMIN 事件处理器：导入配置。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { isAdmin } from "../services/user";
import type { ConfigData } from "../ports/database";

/**
 * 管理员导入配置（合并语义：覆盖或跳过）。
 * @param ctx 请求上下文
 * @returns 导入响应
 */
export const configImportForAdmin: EventHandler = async (ctx) => {
  const isAdminUser = isAdmin(ctx.config, ctx.accessToken);
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  const event = ctx.request.body;
  const importedConfig = event.config as ConfigData;
  const mode = (event.mode as string) || "overwrite"; // overwrite | skip

  if (!importedConfig || typeof importedConfig !== "object") {
    return { code: RES_CODE.PARAM_ERROR, message: "配置格式不合法" };
  }

  // 合并配置
  const mergedConfig: ConfigData = { ...ctx.config };
  if (mode === "overwrite") {
    // 覆盖模式：用导入的配置覆盖现有配置
    Object.assign(mergedConfig, importedConfig);
  } else {
    // 跳过模式：只填充现有配置中不存在的字段
    for (const [key, value] of Object.entries(importedConfig)) {
      if (mergedConfig[key as keyof ConfigData] === undefined) {
        mergedConfig[key as keyof ConfigData] = value;
      }
    }
  }

  // 排除 CREDENTIALS（不允许通过导入设置）
  delete mergedConfig.CREDENTIALS;

  // 保存配置
  await ctx.adapters.database.saveConfig(mergedConfig);
  return { code: RES_CODE.SUCCESS };
};

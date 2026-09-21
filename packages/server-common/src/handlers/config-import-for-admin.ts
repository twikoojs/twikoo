/**
 * CONFIG_IMPORT_FOR_ADMIN 事件处理器：导入配置。
 */
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { isAdmin } from "../services/user";
import type { ConfigData } from "../ports/database";

/**
 * 校验导入内容：必须是普通对象，且值只能是字符串/数字/布尔。
 *
 * JSON.parse 的产物只可能是普通对象、数组与原始值，故用「非数组 + 逐值类型」
 * 即可覆盖；目的是拦住数组、null 等非 ConfigData 值，避免它们落库。
 * @param value 待校验值
 * @returns 是否符合配置形态
 */
function isPlainConfig(value: unknown): value is ConfigData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  );
}

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
  const importedConfig = event.config;
  const mode = event.mode;

  if (!isPlainConfig(importedConfig)) {
    return { code: RES_CODE.FAIL, message: "配置格式不合法" };
  }
  if (mode !== "overwrite" && mode !== "skip") {
    return { code: RES_CODE.FAIL, message: "mode 仅支持 overwrite 或 skip" };
  }

  // 合并配置
  const mergedConfig: ConfigData = { ...ctx.config };
  if (mode === "overwrite") {
    // 覆盖模式：用导入的配置覆盖现有配置
    Object.assign(mergedConfig, importedConfig);
  } else {
    // 跳过模式：只填充现有配置中不存在的字段
    for (const [key, value] of Object.entries(importedConfig)) {
      if (mergedConfig[key] === undefined) {
        mergedConfig[key] = value;
      }
    }
  }

  // 排除 CREDENTIALS（不允许通过导入设置）
  delete mergedConfig.CREDENTIALS;

  // 保存配置
  await ctx.adapters.database.saveConfig(mergedConfig);
  return { code: RES_CODE.SUCCESS };
};

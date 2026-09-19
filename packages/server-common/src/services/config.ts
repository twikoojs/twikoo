/**
 * 配置服务（1.x getConfig/getConfigForAdmin/setConfig 语义对齐）。
 *
 * 安全要点（1.x 注释原样保留）：对外配置按白名单构建，避免在启用某一
 * 验证码供应商时泄露另一个供应商的 key；管理员配置删除 CREDENTIALS 后返回。
 */
import type { ConfigData } from "../ports/database";
import type { TkResponseBody } from "../ports/response";
import { RES_CODE } from "../utils/constants";
import { VERSION } from "@twikoojs/shared";

/**
 * 构建对外公开配置（1.x getConfig 逐字段对齐）。
 * @param config 全量配置
 * @param isAdminUser 是否管理员
 * @returns 公开配置响应
 */
export function getPublicConfig(config: ConfigData, isAdminUser: boolean): TkResponseBody {
  /** 对外白名单配置 */
  const baseConfig: ConfigData = {
    VERSION,
    IS_ADMIN: isAdminUser,
    SITE_NAME: config.SITE_NAME,
    SITE_URL: config.SITE_URL,
    MASTER_TAG: config.MASTER_TAG,
    COMMENT_BG_IMG: config.COMMENT_BG_IMG,
    GRAVATAR_CDN: config.GRAVATAR_CDN,
    DEFAULT_GRAVATAR: config.DEFAULT_GRAVATAR,
    SHOW_IMAGE: config.SHOW_IMAGE || "true",
    IMAGE_CDN: config.IMAGE_CDN,
    LIGHTBOX: config.LIGHTBOX || "false",
    SHOW_EMOTION: config.SHOW_EMOTION || "true",
    EMOTION_CDN: config.EMOTION_CDN,
    COMMENT_PLACEHOLDER: config.COMMENT_PLACEHOLDER,
    SHOW_ORDER: config.SHOW_ORDER || "true",
    SHOW_DISLIKE: config.SHOW_DISLIKE || "true",
    DISPLAYED_FIELDS: config.DISPLAYED_FIELDS,
    REQUIRED_FIELDS: config.REQUIRED_FIELDS,
    HIDE_ADMIN_CRYPT: config.HIDE_ADMIN_CRYPT,
    HIGHLIGHT: config.HIGHLIGHT || "true",
    HIGHLIGHT_THEME: config.HIGHLIGHT_THEME,
    HIGHLIGHT_PLUGIN: config.HIGHLIGHT_PLUGIN,
    LIMIT_LENGTH: config.LIMIT_LENGTH,
    CAPTCHA_PROVIDER: config.CAPTCHA_PROVIDER,
  };

  // 仅在明确指定使用 Turnstile 时下发 Turnstile 的 site key
  if (config.CAPTCHA_PROVIDER === "Turnstile") {
    baseConfig.TURNSTILE_SITE_KEY = config.TURNSTILE_SITE_KEY;
  }

  // 仅在明确指定使用 Geetest 时下发 Geetest 的 id
  if (config.CAPTCHA_PROVIDER === "Geetest") {
    baseConfig.GEETEST_CAPTCHA_ID = config.GEETEST_CAPTCHA_ID;
  }

  // Cap：有外部 endpoint 则下发；否则标记 builtin，前端走 twikoo 事件代理
  if (config.CAPTCHA_PROVIDER === "Cap") {
    if (config.CAP_API_ENDPOINT) {
      baseConfig.CAP_API_ENDPOINT = config.CAP_API_ENDPOINT;
    } else {
      baseConfig.CAP_BUILTIN = true;
    }
  }

  return {
    code: RES_CODE.SUCCESS,
    config: baseConfig,
  };
}

/**
 * 管理员读取全量配置（1.x getConfigForAdmin 对齐：删除 CREDENTIALS 后返回）。
 * @param config 全量配置
 * @param isAdminUser 是否管理员
 * @returns 配置响应
 */
export function getConfigForAdmin(config: ConfigData, isAdminUser: boolean): TkResponseBody {
  if (isAdminUser) {
    /** 摘除凭证后的副本（不改动内存态原配置） */
    const safeConfig = { ...config };
    delete safeConfig.CREDENTIALS;
    return {
      code: RES_CODE.SUCCESS,
      config: safeConfig,
    };
  }
  return {
    code: RES_CODE.NEED_LOGIN,
    message: "请先登录",
  };
}

/**
 * 修改配置（1.x setConfig 对齐：管理员写入库；键集合由管理面板约束）。
 * @param options 配置写入载荷
 * @returns 响应体
 */
export async function setConfig(options: {
  /** 待写入的配置增量 */
  newConfig: ConfigData;
  /** 是否管理员 */
  isAdminUser: boolean;
  /** 落库函数（saveConfig 合并语义） */
  saveConfig: (config: ConfigData) => Promise<void>;
}): Promise<TkResponseBody> {
  const { newConfig, isAdminUser, saveConfig } = options;
  if (!isAdminUser) {
    return { code: RES_CODE.NEED_LOGIN, message: "请先登录" };
  }
  await saveConfig(newConfig);
  return { code: RES_CODE.SUCCESS };
}

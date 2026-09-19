/**
 * 头像地址推导（1.x `utils/avatar.js` + `TkAvatar.vue` 的 computed 逻辑合并下沉）。
 *
 * 优先级（与 1.x 完全一致）：
 * 1. 服务端下发的 `avatar` 字段；
 * 2. 服务端下发的 `mailMd5`（邮件 hash）；
 * 3. 本地邮箱为 QQ 号/QQ 邮箱 → 腾讯 QQ 头像；
 * 4. 本地邮箱 → Gravatar 系（`cravatar.cn` 用 md5，其余用 sha256）。
 *
 * 把这段逻辑从组件里抽出来，是为了让「头像地址」这条兼容性敏感规则可被单元测试
 * 直接覆盖（不依赖组件挂载）。
 */
import md5 from "blueimp-md5";
import { sha256 } from "js-sha256";
import { isQQ, normalizeMail } from ".";
import { DEFAULT_GRAVATAR_CDN } from "../i18n/constants";

/**
 * 生成 QQ 头像地址（1.x 基线地址不变）。
 * @param qq QQ 号或 QQ 邮箱
 * @returns 头像地址
 */
export function getQQAvatar(qq: string): string {
  const qqNum = qq.replace(/@qq\.com/gi, "");
  return `https://thirdqq.qlogo.cn/g?b=sdk&nk=${qqNum}&s=140`;
}

/** 头像推导入参（对应服务端 DTO 字段与前端选项） */
export interface AvatarSource {
  /** 服务端下发的头像地址（优先） */
  avatar?: string;
  /** 服务端下发的邮箱 hash */
  mailMd5?: string;
  /** 本地填写的邮箱（meta 输入框） */
  mail?: string;
  /** 昵称（用于 `DEFAULT_GRAVATAR=initials` 占位） */
  nick?: string;
}

/** 头像推导所需的配置项（均为服务端 `GET_CONFIG` 下发值） */
export interface AvatarConfig {
  /** 头像 CDN 域名，留空取 {@link DEFAULT_GRAVATAR_CDN} */
  GRAVATAR_CDN?: string;
  /** 默认头像占位，留空取 `initials&name=<nick>` */
  DEFAULT_GRAVATAR?: string;
}

/**
 * 推导最终头像地址。
 * @param source 头像数据源
 * @param config 配置项
 * @returns 头像地址；无法推导时返回空串（组件回退到默认图标）
 */
export function resolveAvatarUrl(source: AvatarSource, config: AvatarConfig = {}): string {
  if (source.avatar) return source.avatar;
  const gravatarCdn = config.GRAVATAR_CDN || DEFAULT_GRAVATAR_CDN;
  const defaultGravatar = config.DEFAULT_GRAVATAR || `initials&name=${source.nick ?? ""}`;
  if (source.mailMd5) {
    return `https://${gravatarCdn}/avatar/${source.mailMd5}?d=${defaultGravatar}`;
  }
  if (source.mail && isQQ(source.mail)) return getQQAvatar(source.mail);
  if (source.mail) {
    const hash = gravatarCdn === "cravatar.cn" ? md5 : sha256;
    return `https://${gravatarCdn}/avatar/${hash(normalizeMail(source.mail))}?d=${defaultGravatar}`;
  }
  return "";
}

/**
 * 平台能力声明（规范第一层：Capability Flags）。
 *
 * 适配器启动时声明平台能力，公共库在加载第三方库前先查 capabilities：
 * 未声明的能力走降级路径或返回明确的用户友好错误（如 eo-makers 的
 * 「EdgeOne Makers 仅支持 SendGrid、MailChannels，或通过 SMTP_HOST 使用
 * Go SMTP Bridge」），绝不触发顶层 import。
 */

/**
 * 能力开关值：false 完全不支持；"restricted" 为受限形态——功能存在但仅部分
 * 通道可用。受限形态目前仅 mail 使用（能力矩阵：eo-makers 的 mail 为
 * ⚠️ 受限，SendGrid / MailChannels / Go SMTP Bridge），类型上保证该形态可表达。
 */
export type CapabilityFlag = boolean | "restricted";

/** 平台能力声明（八项能力，适配器注入）*/
export interface Capabilities {
  /** 是否支持发邮件（nodemailer）；"restricted" = 仅受限通道（eo-makers 形态） */
  mail: CapabilityFlag;
  /** 是否支持原生 DOMPurify（jsdom + dompurify）；不支持时走直通降级 */
  domPurify: boolean;
  /** 是否支持 IP 属地库（@imaegoo/node-ip2region，体积大） */
  ip2region: boolean;
  /** 是否支持 Akismet 反垃圾（akismet-api） */
  akismet: boolean;
  /** 是否支持腾讯云文本安全（tencentcloud-sdk-nodejs-tms） */
  tencentTms: boolean;
  /** 是否支持图片上传（form-data + 存储） */
  imageUpload: boolean;
  /** 是否支持 QQ 头像（axios） */
  qqAvatar: boolean;
  /** 是否支持 AI 内容生成（@xsai/*） */
  ai: boolean;
}

/** 全能力声明（矩阵：cloudbase / vercel / self-hosted / netlify / aws-lambda 共用）*/
export const FULL_CAPABILITIES: Capabilities = {
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: true,
  qqAvatar: true,
  ai: true,
};

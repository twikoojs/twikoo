/**
 * i18n 常量表（把「常量文案」从翻译词表中分离出来）。
 *
 * 1.x 把这些枚举值内联在 `i18n.js` 里、再以字符串拼接的方式嵌入配置项说明文案
 * （例如 `${highlightThemes.join('、')}`）；2.0 的说明文案已固化进 `locales/*.json`，
 * 本文件因此转为**枚举唯一事实来源**：供管理面板做联动显示（`customImageBedServices`）、
 * 供测试校验文案与枚举一致、供文档生成参考。
 *
 * 注意：这些是「用户可见的可选值」，**不是** twikoo 配置项本身——新增/删除配置项
 * 属 Scope OUT 禁止项（向后兼容），本表只枚举已有配置项的合法取值。
 */
import { PUSHOO_CHANNELS } from "@twikoojs/shared";

/**
 * 即时消息推送渠道（以 pushoo 源码为唯一真相源，从 `@twikoojs/shared` 派生）。
 *
 * 1.x 前端只列了 13 个渠道且与 pushoo 实际支持的渠道不一致（缺 8 个）；
 * 2.0 起 `PUSHOO_CHANNELS` 由 pushoo 的 `ChannelType` 派生并带编译期覆盖校验，
 * 此处直接转出以保证「说明文案 ↔ pushoo 实现」永远同步。
 */
export const pushooChannels: readonly string[] = [...PUSHOO_CHANNELS];

/** nodemailer 内置 SMTP 服务商名（`SMTP_SERVICE` 取值，1.x 基线全量保留） */
export const smtpServices: readonly string[] = [
  "126",
  "163",
  "1und1",
  "AOL",
  "DebugMail",
  "DynectEmail",
  "FastMail",
  "GandiMail",
  "Gmail",
  "Godaddy",
  "GodaddyAsia",
  "GodaddyEurope",
  "Hotmail",
  "Mail.ru",
  "Maildev",
  "Mailgun",
  "Mailjet",
  "Mailosaur",
  "Mandrill",
  "Naver",
  "OpenMailBox",
  "Outlook365",
  "Postmark",
  "QQ",
  "QQex",
  "SES",
  "SES-EU-WEST-1",
  "SES-US-EAST-1",
  "SES-US-WEST-2",
  "SendCloud",
  "SendGrid",
  "SendPulse",
  "SendinBlue",
  "Sparkpost",
  "Yahoo",
  "Yandex",
  "Zoho",
  "hot.ee",
  "iCloud",
  "mail.ee",
  "qiye.aliyun",
];

/** Prism 代码高亮主题（`HIGHLIGHT_THEME` 取值；`none` 表示仅关闭主题样式表） */
export const highlightThemes: readonly string[] = [
  "default",
  "coy",
  "dark",
  "funky",
  "okaidia",
  "solarizedlight",
  "tomorrow",
  "twilight",
];

/** Prism 代码高亮插件（`HIGHLIGHT_PLUGIN` 取值，逗号分隔可多选） */
export const highlightPlugins: readonly string[] = ["showLanguage", "copyButton"];

/** 图床服务（`IMAGE_CDN` 取值；与 TkAdminConfig 的下拉项一一对应） */
export const imageBedServices: readonly string[] = [
  "qcloud",
  "7bu (https://7bu.top)",
  "see (https://s.ee)",
  "lskypro",
  "piclist",
  "easyimage",
  "chevereto",
  "S3 / R2 / MinIO",
];

/**
 * 需要用户额外填写 `IMAGE_CDN_URL` 的自建图床。
 *
 * TkAdminConfig 用它决定 `IMAGE_CDN_URL` 输入框的显示条件（1.x 内联数组的等价物）。
 */
export const customImageBedServices: readonly string[] = ["lskypro", "piclist", "easyimage", "s3"];

/** 默认头像占位图（`DEFAULT_GRAVATAR` 取值；留空等价于 `initials`） */
export const defaultGravatar: readonly string[] = [
  "404",
  "mp",
  "identicon",
  "monsterid",
  "wavatar",
  "retro",
  "robohash",
  "blank",
];

/** 默认 Gravatar CDN（`GRAVATAR_CDN` 留空时的取值，1.x 基线） */
export const DEFAULT_GRAVATAR_CDN = "weavatar.com";

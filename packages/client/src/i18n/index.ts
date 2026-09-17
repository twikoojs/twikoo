/**
 * i18n 运行时（§7.2/§7.3：一语言一文件 + 英文兜底 + TranslationKey 类型安全）。
 *
 * 语言优先级：init 入参 lang → 浏览器语言 → 英文兜底。
 * 加载失败（分片损坏/缺失）回退英文且不抛错（R-8/R-9）。
 * 兼容别名：zh → zh-CN、zh-TW/zh-HK 保留、en-US/en-GB → en 等（1.x langs 表对齐）。
 */
import zhCN from "./locales/zh-CN.json";
import zhHK from "./locales/zh-HK.json";
import zhTW from "./locales/zh-TW.json";
import en from "./locales/en.json";
import uzUZ from "./locales/uz-UZ.json";
import jaJP from "./locales/ja-JP.json";
import koKR from "./locales/ko-KR.json";
import viVN from "./locales/vi-VN.json";
import idID from "./locales/id-ID.json";
import keys from "./locales/_keys.json";

/** 翻译键真相源（从 zh-CN 键集派生，缺键 tsc 报错） */
export type TranslationKey = keyof typeof zhCN;

/** 全部翻译键清单（键集 diff 校验用） */
export const TRANSLATION_KEYS = keys as TranslationKey[];

/** 语言表（键为 ISO 小写，值为 locale 文件键；1.x langs 表对齐） */
const LANG_ALIASES: Record<string, string> = {
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-hk": "zh-HK",
  "zh-tw": "zh-TW",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  uz: "uz-UZ",
  "uz-uz": "uz-UZ",
  ja: "ja-JP",
  "ja-jp": "ja-JP",
  ko: "ko-KR",
  "ko-kr": "ko-KR",
  vi: "vi-VN",
  "vi-vn": "vi-VN",
  id: "id-ID",
  "id-id": "id-ID",
};

/** 语言文件表 */
const LOCALES: Record<string, Record<TranslationKey, string>> = {
  "zh-CN": zhCN,
  "zh-HK": zhHK,
  "zh-TW": zhTW,
  en: en,
  "uz-UZ": uzUZ,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "vi-VN": viVN,
  "id-ID": idID,
};

/** 英文兜底 */
const FALLBACK = "en";

/** 当前语言（初始化后生效） */
let currentLang = FALLBACK;

/**
 * 设置语言（1.x setLanguage 对齐；选项优先于浏览器语言）。
 * @param options 前端选项（lang）
 */
export function setLanguage(options: { lang?: string } = {}): void {
  const option = options.lang?.toLowerCase();
  const browser = navigator.language?.toLowerCase();
  currentLang = (option && LANG_ALIASES[option]) || (browser && LANG_ALIASES[browser]) || FALLBACK;
}

/** 获取当前语言 */
export function getLanguage(): string {
  return currentLang;
}

/**
 * 翻译（TranslationKey 类型安全；缺失键回退英文，再缺失返回键名）。
 * @param key 翻译键
 * @param lang 目标语言（缺省用当前语言）
 * @returns 翻译文案
 */
export function t(key: TranslationKey, lang?: string): string {
  const target = (lang && LANG_ALIASES[lang.toLowerCase()]) || currentLang;
  const value = LOCALES[target]?.[key] ?? LOCALES[FALLBACK]?.[key] ?? "";
  return value;
}

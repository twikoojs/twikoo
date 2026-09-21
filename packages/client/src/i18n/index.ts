/**
 * i18n 运行时（一语言一文件 + 按需分片 + 英文兜底 + TranslationKey 类型安全）。
 *
 * **打包策略**：
 * - `zh-CN` / `en` **内置**进主产物（`en` 同时是 fallback 源）；
 * - 其余 7 种（`zh-HK` / `zh-TW` / `uz-UZ` / `ja-JP` / `ko-KR` / `vi-VN` / `id-ID`）
 *   各为一个独立分片 `dist/locales/<lang>.js`，运行时按需动态加载。
 *
 * **加载纪律**：分片基址从主脚本自身 URL 推导（UMD 场景无 `import.meta.url`）；
 * 任何加载失败（网络错误 / 404 / 解析失败）一律**回退英文并记 warn，绝不抛出、绝不阻塞渲染**。
 *
 * **用法**：`init()` 内先 `await loadLanguage(options)` 再挂载，因此组件渲染时语言已就位，
 * 不需要「加载完成后重新渲染」。运行中切换语言可再次调用 `loadLanguage`。
 */
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";
import keys from "./locales/_keys.json";

/** 单个语言的词表 */
type Locale = Record<string, string>;

/** 翻译键真相源（从 zh-CN 键集派生，缺键 tsc 报错） */
export type TranslationKey = keyof typeof zhCN;

/** 全部翻译键清单（键集 diff 校验用） */
export const TRANSLATION_KEYS = keys as TranslationKey[];

/** 英文兜底语言 */
const FALLBACK = "en";

/** 内置语言（打进主产物，无需网络） */
const BUILTIN: Record<string, Locale> = {
  "zh-CN": zhCN,
  en,
};

/** 需要按需加载的语言（分片文件名与语言标识同名） */
export const LAZY_LOCALES = [
  "zh-HK",
  "zh-TW",
  "uz-UZ",
  "ja-JP",
  "ko-KR",
  "vi-VN",
  "id-ID",
] as const;

/** 已加载的分片语言 */
const loadedLocales: Record<string, Locale> = {};

/** 语言表（键为 ISO 小写，值为 locale 键；1.x langs 表对齐） */
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

/** 当前语言（初始化后生效） */
let currentLang = FALLBACK;

/** 分片基址（显式覆写优先；否则从主脚本 URL 推导） */
let localeBaseUrl = "";

/**
 * 覆写语言分片基址（CDN / 子路径部署时可显式指定，避免自动推导失准）。
 * @param url 分片所在目录的绝对地址（末尾斜杠可有可无）
 */
export function setLocaleBaseUrl(url: string): void {
  localeBaseUrl = url.replace(/\/+$/, "");
}

/**
 * 从主脚本自身 URL 推导分片基址。
 *
 * UMD 产物没有 `import.meta.url`，故取 `document.currentScript`（脚本同步执行期间有效）；
 * 若为 null（模块脚本 / 异步场景），回退为扫描页面内 src 含 `twikoo` 的 script。
 * @returns 分片所在目录（推导失败为空串）
 */
function detectLocaleBaseUrl(): string {
  if (typeof document === "undefined") return "";
  const current = document.currentScript as HTMLScriptElement | null;
  let src = current?.src ?? "";
  if (!src) {
    const scripts = document.querySelectorAll("script[src]");
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const candidate = (scripts[i] as HTMLScriptElement).src;
      if (/twikoo/i.test(candidate)) {
        src = candidate;
        break;
      }
    }
  }
  return src ? src.slice(0, src.lastIndexOf("/")) : "";
}

/**
 * 解析目标语言（优先级：入参 → 浏览器语言 → 英文兜底；均走别名归并）。
 * @param options 前端选项（lang）
 * @returns 归并后的语言标识
 */
function resolveLanguage(options: { lang?: string } = {}): string {
  const option = options.lang?.toLowerCase();
  const browser = typeof navigator === "undefined" ? undefined : navigator.language?.toLowerCase();
  return (option && LANG_ALIASES[option]) || (browser && LANG_ALIASES[browser]) || FALLBACK;
}

/**
 * 设置语言（同步；1.x `setLanguage` 语义对齐）。
 *
 * 仅记录目标语言——内置语言立即生效；分片语言在 {@link loadLanguage} 完成前，
 * `t()` 会走英文兜底（绝不阻塞、绝不抛错）。
 * @param options 前端选项（lang）
 */
export function setLanguage(options: { lang?: string } = {}): void {
  currentLang = resolveLanguage(options);
}

/**
 * 取当前语言标识。
 * @returns 语言标识（如 `zh-CN`）
 */
export function getLanguage(): string {
  return currentLang;
}

/**
 * 按需加载当前（或指定）语言的分片。**失败不抛**，回退英文并记 warn。
 *
 * `init()` 会在挂载前 await 本函数；运行中切换语言可再次调用。
 * @param options 前端选项（lang：目标语言；localeBaseUrl：分片基址覆写）
 * @returns 加载完成的 Promise（无论成败都 resolve）
 */
export async function loadLanguage(
  options: { lang?: string; localeBaseUrl?: string } = {},
): Promise<void> {
  const target = resolveLanguage(options);
  currentLang = target;
  if (BUILTIN[target] || loadedLocales[target]) return;
  // 必须用 `||` 而非 `??`：localeBaseUrl 的初值是空串（语义为「未设置」），
  // 而 `??` 只对 null / undefined 回退 —— 空串会直接短路，detectLocaleBaseUrl()
  // 永远不会被调用，于是任何非内置语言都恒报「无法推导基址」。
  const base = (options.localeBaseUrl || localeBaseUrl || detectLocaleBaseUrl()).replace(
    /\/+$/,
    "",
  );
  if (!base) {
    console.warn(`[twikoo] 无法推导语言分片基址，${target} 回退英文`);
    return;
  }
  try {
    // 变量 specifier：打包器不解析，保持运行时原生动态导入（分片不参与主产物打包）
    const specifier = `${base}/locales/${target}.js`;
    const mod = (await import(/* @vite-ignore */ specifier)) as { default?: Locale } & Locale;
    const table = mod.default ?? mod;
    if (table && typeof table === "object") {
      loadedLocales[target] = table;
    } else {
      console.warn(`[twikoo] 语言分片 ${target} 形态异常，回退英文`);
    }
  } catch (e) {
    console.warn(
      `[twikoo] 语言分片 ${target} 加载失败，回退英文：`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * 翻译（TranslationKey 类型安全）。
 *
 * 取值顺序：目标语言分片/内置 → 英文兜底 → 空串（绝不抛错）。
 * @param key 翻译键
 * @param lang 目标语言（缺省用当前语言）
 * @returns 翻译文案
 */
export function t(key: TranslationKey, lang?: string): string {
  const target = (lang && LANG_ALIASES[lang.toLowerCase()]) || currentLang;
  const table = loadedLocales[target] ?? BUILTIN[target];
  return table?.[key] ?? BUILTIN[FALLBACK]?.[key] ?? "";
}

/**
 * 文档站语言自动探测。
 *
 * 规则：
 * 1. **`?lang=` 覆盖**：显式指定优先（`zh*` → root，其它 → `/en/`）；
 * 2. **已有 localStorage 记录 → 不跳**（用户此前已表达偏好，避免反复跳转）；
 * 3. **仅首页参与自动跳转**（内页不跳，避免打断阅读）；
 * 4. 中文浏览器留在 root，其它语言进 `/en/`；反向（在 `/en/` 首页且浏览器为中文）回 root。
 *
 * **防循环**：跳转前先写入 localStorage，因此第 2 条会立刻生效——同一会话内不会来回跳。
 * 本模块只做纯判定（`resolveLangRedirect`），DOM/localStorage 访问集中在带守卫的小函数里。
 */

/** localStorage 记录语言偏好的键名 */
export const LANG_STORAGE_KEY = "twikoo-docs-lang";

/** 英文站首页路径 */
export const EN_HOME = "/en/";

/** 中文站（root）首页路径 */
export const ROOT_HOME = "/";

/** 判定结果原因（便于调试与单测断言） */
export type LangRedirectReason =
  "query-override" | "stored" | "not-home" | "zh-preference" | "non-zh-preference";

/** 判定输入 */
export interface LangDetectInput {
  /** 当前路径（`location.pathname`） */
  pathname: string;
  /** 查询串（`location.search`，含前导 `?`，可省略） */
  search?: string;
  /** localStorage 中已记录的语言偏好（无记录传 null/undefined） */
  stored?: string | null;
  /** 浏览器语言（`navigator.language`） */
  navigatorLang?: string;
}

/** 判定结果 */
export interface LangDetectResult {
  /** 跳转目标路径；`null` 表示不跳转 */
  target: string | null;
  /** 判定原因 */
  reason: LangRedirectReason;
}

/**
 * 判断是否为中文语言标签（`zh`、`zh-CN`、`zh-Hans` 等）。
 * @param lang 语言标签
 * @returns true 表示中文
 */
export function isChineseLang(lang: string): boolean {
  return lang.toLowerCase().startsWith("zh");
}

/**
 * 判断路径是否为某一语言的首页。
 * @param pathname 路径
 * @returns 是否为首页（root `/`、`/index.html`、`/en/`、`/en/index.html`）
 */
export function isHomePath(pathname: string): boolean {
  const normalized = pathname.replace(/index\.html$/, "");
  return normalized === "/" || normalized === EN_HOME;
}

/**
 * 语言偏好 → 目标首页路径。
 * @param lang 语言偏好（`zh*` 或其它）
 * @returns 目标路径
 */
export function homeForLang(lang: string): string {
  return isChineseLang(lang) ? ROOT_HOME : EN_HOME;
}

/**
 * 纯判定：根据当前路径、查询串、已存偏好与浏览器语言，决定是否跳转。
 * @param input 判定输入
 * @returns 判定结果（`target` 为 `null` 即不跳）
 */
export function resolveLangRedirect(input: LangDetectInput): LangDetectResult {
  const { pathname, search = "", stored = null, navigatorLang = "" } = input;

  /** 1. `?lang=` 显式覆盖 */
  const forced = new URLSearchParams(search).get("lang");
  if (forced !== null && forced !== "") {
    const target = homeForLang(forced);
    return { target: target === pathname ? null : target, reason: "query-override" };
  }

  /** 2. 已有记录 → 不跳（防循环的关键） */
  if (stored) return { target: null, reason: "stored" };

  /** 3. 仅首页参与自动跳转 */
  if (!isHomePath(pathname)) return { target: null, reason: "not-home" };

  /** 4. 浏览器语言偏好（中文留 root，其它进 /en/） */
  const preferred = homeForLang(navigatorLang);
  const reason: LangRedirectReason = isChineseLang(navigatorLang)
    ? "zh-preference"
    : "non-zh-preference";
  return { target: preferred === pathname ? null : preferred, reason };
}

/**
 * 读取已记录的语言偏好（localStorage 不可用时返回 null）。
 * @returns 语言偏好字符串
 */
export function readStoredLang(): string | null {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * 写入语言偏好（localStorage 不可用时静默跳过——隐私模式下不应抛错）。
 * @param lang 语言偏好字符串
 */
export function writeStoredLang(lang: string): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* 隐私模式 / 存储配额：忽略 */
  }
}

/**
 * 在浏览器端执行一次语言探测与跳转（`?lang=` 会顺带记录偏好）。
 *
 * 仅在客户端调用（SSR 阶段 `window` 不存在即直接返回）；跳转前先落盘偏好，
 * 保证不会出现两页互跳。
 */
export function runLangRedirect(): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  const result = resolveLangRedirect({
    pathname,
    search: window.location.search,
    stored: readStoredLang(),
    navigatorLang: window.navigator.language,
  });
  if (!result.target || result.target === pathname) return;
  /** 先落盘再跳转：下一次判定即命中「已有记录 → 不跳」，杜绝两页互跳 */
  writeStoredLang(result.target === EN_HOME ? "en" : "zh");
  window.location.replace(result.target + window.location.hash);
}

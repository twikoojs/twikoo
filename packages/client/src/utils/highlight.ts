/**
 * Prism 代码高亮（1.x `utils/highlight.js` 语义对齐，「renderCode 走 Prism，保持」）。
 *
 * 行为保持：
 * - Prism **core 随主产物打包**，语言组件与主题样式表按需从 CDN 加载
 *   （`prism-autoloader` 从 `${prismCdn}/components/` 取语言，主题以 `<link>` 注入）；
 * - `prismCdn` 可由 `twikoo.init({ prismCdn })` 覆盖（1.x 同名选项）；
 * - 插件 `HIGHLIGHT_PLUGIN` 支持 `showLanguage`（显示语言名）与 `copyButton`（复制按钮）；
 * - `manual = true` 关闭 Prism 的 DOMContentLoaded 自动高亮，改由本模块按需触发。
 *
 * 2.0 实现差异（等价或不劣化）：
 * - 用 `await import()` 取代 1.x 的 `require()`——顺序仍受控（先置全局 Prism、
 *   再载插件），从而让 Prism 的 UMD 插件能探测到全局 `Prism`；
 *   Rollup 会把动态导入内联为惰性 init 函数，因此 UMD 产物不需要代码分割。
 * - 主题 `<link>` 的宿主元素从「写死 `#twikoo`」改为「`#twikoo` → `.twikoo` → body」
 *   逐级回退，避免自定义挂载点（如 demo 的 `#tcomment`）时抛 TypeError。
 */
import { logger } from "./logger";
import { getAppState } from "./api";

/** Prism 默认 CDN 前缀（1.x 同值） */
const PRISM_CDN = "https://cdn.jsdelivr.net/npm/prismjs@1.28.0";

/** Prism 命名空间最小结构面（仅本模块用到的成员） */
interface PrismApi {
  plugins: Record<string, Record<string, unknown>>;
  highlightAllUnder: (element: Element) => void;
}

/** 全局 window 上的 Prism（Core 加载前先放一个 `{ manual: true }` 占位） */
type WindowWithPrism = Window & { Prism?: { manual?: boolean } & Partial<PrismApi> };

/** Prism core 加载 Promise（进程内只加载一次；失败缓存为 null 避免反复重试） */
let prismPromise: Promise<PrismApi | null> | null = null;

/** 已加载的 Prism 插件名（1.x 只在首次调用时装载插件；此集合保证后续调用也能补载） */
const loadedPlugins = new Set<string>();

/** 已注入的主题样式表（避免重复注入） */
let cssEl: HTMLLinkElement | null = null;

/**
 * 解析 Prism CDN 前缀（`twikoo.init({ prismCdn })` 优先）。
 * @returns CDN 前缀
 */
function resolvePrismCdn(): string {
  const custom = getAppState().options.prismCdn;
  return typeof custom === "string" && custom ? custom : PRISM_CDN;
}

/**
 * 取主题样式表的宿主元素。
 * @returns 宿主元素（`#twikoo` → `.twikoo` → `document.body`）
 */
function getRootEl(): HTMLElement {
  return (
    document.getElementById("twikoo") ??
    document.querySelector<HTMLElement>(".twikoo") ??
    document.body
  );
}

/**
 * 加载 Prism core（带进程内缓存）。
 * @returns Prism 命名空间；加载失败返回 null
 */
async function loadPrism(): Promise<PrismApi | null> {
  const win = window as WindowWithPrism;
  // 必须在 Prism core 求值前写好 manual 标记：core 会读 `window.Prism.manual`
  // 决定是否在 DOMContentLoaded 时自动高亮（1.x 同序）
  win.Prism = win.Prism ?? {};
  win.Prism.manual = true;

  const mod = (await import("prismjs")) as unknown as { default?: PrismApi } & PrismApi;
  const Prism = mod.default ?? mod;
  // Rollup/Vite 下 prismjs 只写 module.exports，不会挂到 window；插件靠全局探测，
  // 因此这里显式桥接一次（webpack 5 由 `global` → `globalThis` 自动完成）
  win.Prism = Prism;

  await import("prismjs/plugins/autoloader/prism-autoloader.js");
  const autoloader = Prism.plugins.autoloader;
  if (autoloader) autoloader.languages_path = `${resolvePrismCdn()}/components/`;
  loadedPlugins.add("autoloader");
  return Prism;
}

/**
 * 按需装载 `HIGHLIGHT_PLUGIN` 指定的 Prism 插件（幂等）。
 *
 * 与 1.x 的差异：1.x 只在首次调用 `renderCode` 时装载插件，若首次调用时配置尚未
 * 到位则插件永久缺失；此处改为「每次调用补齐缺失项」，插件模块本身由打包器惰性
 * init（重复 import 不会重复求值）。
 * @param plugins `HIGHLIGHT_PLUGIN` 原始值（逗号分隔；`none`/空表示不装载）
 */
async function ensurePlugins(plugins: string): Promise<void> {
  if (!plugins || plugins === "none") return;
  const wanted = plugins
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p === "showLanguage" || p === "copyButton");
  if (wanted.length === 0 || wanted.every((p) => loadedPlugins.has(p))) return;
  await import("prismjs/plugins/toolbar/prism-toolbar.js");
  for (const plugin of wanted) {
    if (plugin === "showLanguage") {
      await import("prismjs/plugins/show-language/prism-show-language.js");
    } else {
      await import("prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard.js");
    }
    loadedPlugins.add(plugin);
  }
}

/**
 * 注入 Prism 主题样式表（同一文档内只注入一次）。
 * @param theme `HIGHLIGHT_THEME` 取值；`none`/空表示不注入
 * @param prismCdn CDN 前缀
 */
function loadCss(theme: string, prismCdn: string): void {
  if (!theme || theme === "none") return;
  const root = getRootEl();
  if (cssEl && root.contains(cssEl)) return;
  const link = document.createElement("link");
  link.href =
    theme === "default"
      ? `${prismCdn}/themes/prism.min.css`
      : `${prismCdn}/themes/prism-${theme}.min.css`;
  link.rel = "stylesheet";
  link.type = "text/css";
  root.appendChild(link);
  cssEl = link;
}

/**
 * 对容器内的代码块做语法高亮（1.x `renderCode` 等价入口）。
 *
 * 内部改为异步（Prism 按需 `import`），对外仍是「调用即生效」的 fire-and-forget：
 * 与 1.x 的差异仅在于「高亮完成时刻」——调用方无需 `await`。
 * @param el 待高亮的容器（评论正文 / 预览区 / 管理面板列表）
 * @param theme `HIGHLIGHT_THEME` 取值
 * @param plugins `HIGHLIGHT_PLUGIN` 取值（逗号分隔）
 */
export function renderCode(el: Element | null, theme?: string, plugins?: string): void {
  if (!el) return;
  // 未配置主题/插件时仍需高亮（1.x 行为：主题只影响样式表，不影响高亮本身）
  prismPromise =
    prismPromise ??
    loadPrism().catch((e: unknown) => {
      logger.warn("Prism 代码高亮加载失败", e);
      return null;
    });
  void prismPromise
    .then(async (Prism) => {
      if (!Prism) return;
      await ensurePlugins(plugins ?? "");
      loadCss(theme ?? "", resolvePrismCdn());
      Prism.highlightAllUnder(el);
    })
    // 高亮属增强能力：任何异常只告警，绝不影响评论渲染（1.x 同类兜底）
    .catch((e: unknown) => logger.warn("代码高亮执行失败", e));
}

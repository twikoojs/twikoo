/**
 * 重依赖预热：把 jsdom / DOMPurify 的加载从「调用路径」挪到「实例初始化阶段」。
 *
 * ## 为什么必须预热
 *
 * `@twikoojs/common` 的重依赖一律经 `lib-loader` 的 `loadLib()` **动态** import，
 * 于是 jsdom（4.2MB）的**首次**加载落在调用里。真机实测（2026-09-28，腾讯云 CloudBase
 * 免费体验版）：一个只做 `await import("jsdom")` + `new JSDOM("")` 的探针就会
 * **打满 3 秒执行超时**；而同一实例紧接着的第二次调用只要 **13ms**（模块已在进程内）
 * —— 即贵的是「首次加载」，与用不用 `import()` 无关。
 *
 * 而免费体验版与个人版的云函数**执行超时固定 3 秒、不可修改**（见 `docs/backend.md`），
 * 这 3 秒直接决定「发评论」能否成功：`COMMENT_SUBMIT` 会经 `getDomPurify()` 加载 jsdom。
 *
 * ## 解法
 *
 * 在模块初始化阶段**同步**把 DOMPurify 装好，用 `setCustomLibs` 注入
 * （1.x `lib.js` 的逃生舱范式，EdgeOne Makers 适配器同款做法）。
 * `getDomPurify()` 里 `customLibs.DOMPurify` 优先级最高、直接返回，
 * `loadLib` 根本不会被调用 —— 实测覆写生效后该调用耗时 **0ms**。
 *
 * ## 实测效果（真实 `COMMENT_SUBMIT`，同一环境同一函数）
 *
 * | 指标 | 预热前 | 预热后 |
 * | --- | --- | --- |
 * | `InitFunction` | 594ms | 3574ms |
 * | 冷实例调用 | **3000ms 超时** | **1078ms 成功** |
 * | 热实例调用 | — | 454 / 714 / 1933ms |
 *
 * 即这 3 秒开销**从「执行时长」挪进了「初始化时长」**，而平台接受 3.6 秒的初始化。
 *
 * ## 为什么不能写成「模块顶层的浮空 Promise」
 *
 * CJS 没有顶层 await，浮空预热与首次调用是**竞态**：handler 等不到它跑完就开始了，
 * 首次请求照样超时（已实测）。所以这里的 import 必须是**同步**的。
 *
 * ## 破例说明与代价
 *
 * 本文件是全仓第二处**静态** import 重依赖的地方（另一处是
 * `packages/pkg/src/bundled-libs.ts`，目的是把重依赖内联进 SEA 单文件产物）。
 * AGENTS.md「重依赖全部 external + 动态加载」的禁令只约束
 * `packages/server-common/src/**`（由 `test/utils/lib-loader-literals.test.ts` 断言），
 * 适配器侧不受该断言约束；但为守住「薄适配器」，这里**只预热发评论路径上必需的
 * jsdom + DOMPurify**，其余重依赖维持动态加载。
 *
 * 代价：冷启动 `InitFunction` 由 ~0.6s 涨到 ~3.6s（每次新建实例都付），常驻内存 +~36MB。
 */
import * as dompurifyModule from "dompurify";
import * as jsdomModule from "jsdom";
import { setCustomLibs } from "@twikoojs/common";

/** jsdom 的最小结构面（与 `@twikoojs/common` 的 `JSDOMLike` 同构，不引入其类型依赖） */
interface JSDOMCtor {
  /**
   * @param html HTML 文本
   * @returns window 环境句柄
   */
  new (html: string): { window: unknown };
}

/** DOMPurify 工厂与实例的最小结构面（1.x `createDOMPurify(window)` 语义） */
type DOMPurifyFactory = (window: unknown) => {
  /**
   * 消毒 HTML
   * @param dirty 原始 HTML
   * @param config 消毒配置
   * @returns 消毒后的 HTML
   */
  sanitize(dirty: string, config?: unknown): string;
};

/**
 * 取 CJS/ESM 兼容的模块本体（ESM 命名空间的 `default` 优先）。
 *
 * `import * as X from "<CJS 包>"` 在 ESM 下拿到的是命名空间
 * （`{ default: module.exports, ...具名导出 }`），本体不能直接调用；
 * 而 CJS 产物里 rolldown 会合成 `default`。两种形态都要能取到本体 ——
 * 与 `@twikoojs/common` 的 `pickDefault` 同一语义（那边是包内私有函数，故此处复刻）。
 * @param namespace 模块命名空间
 * @returns 模块本体
 */
function pickDefault<T>(namespace: unknown): T {
  const space = namespace as { default?: T } | null | undefined;
  return (space?.default ?? namespace) as T;
}

/**
 * 预热好的 DOMPurify 实例（构造失败时为 `null`，交回 `getDomPurify` 的动态加载路径）。
 *
 * 用 try/catch 兜住构造：jsdom / dompurify 若因环境原因构造失败，应当退回
 * 「按需动态加载」而不是让整个云函数起不来；但**必须留痕** ——
 * 静默回退会让冷调用重新背上 3 秒级的 jsdom 首次加载（同 #1127 的教训）。
 */
const prewarmedDOMPurify: ReturnType<DOMPurifyFactory> | null = (() => {
  try {
    const { JSDOM } = pickDefault<{ JSDOM: JSDOMCtor }>(jsdomModule);
    const createDOMPurify = pickDefault<DOMPurifyFactory>(dompurifyModule);
    return createDOMPurify(new JSDOM("").window);
  } catch (e) {
    console.warn(
      "[twikoo] 重依赖预热失败，已回退按需加载（冷调用会重新付 jsdom 首次加载）：",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
})();

if (prewarmedDOMPurify) {
  setCustomLibs({ DOMPurify: prewarmedDOMPurify });
}

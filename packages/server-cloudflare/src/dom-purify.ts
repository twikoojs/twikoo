/**
 * 评论内容消毒（Workers 无 jsdom，故不用原生 dompurify）。
 *
 * 1.x twikoo-cloudflare 用 `xss` 包做消毒（`dompurify` 依赖 `jsdom`，而 jsdom 在
 * Workers 里跑不起来），2.0 沿用同一策略：能力声明 `domPurify: false`，同时经
 * `setCustomLibs` 注入本垫片——**覆写优先于能力门**，故 `getDomPurify()` 拿到的就是它，
 * 消毒能力实际可用（与 eo-makers 的「直通 DOMPurify」不同：这里做真正的白名单过滤，
 * 而不是原样放行）。
 *
 * 与原生 DOMPurify 的差异：`sanitize(dirty, config)` 的第二个参数在本垫片里不生效——
 * `xss` 是白名单制，`style` 标签与 `style` 属性本就不在默认白名单内（1.x 调用形态也是
 * 不带配置的 `xss(comment)`），故 `FORBID_TAGS: ["style"]` 的意图已由默认白名单满足。
 */
import xss from "xss";
import type { DOMPurifyLike } from "@twikoojs/common";

/**
 * 构造可注入 `setCustomLibs` 的 DOMPurify 形态对象。
 * @returns DOMPurify 垫片
 */
export function createXssDOMPurify(): DOMPurifyLike {
  return {
    /**
     * 消毒 HTML（默认白名单：保留常见文本/链接/图片标签，剥离 script、事件属性与 style）
     * @param dirty 原始 HTML
     * @returns 消毒后的 HTML
     */
    sanitize(dirty: string): string {
      return String(xss(dirty));
    },
  };
}

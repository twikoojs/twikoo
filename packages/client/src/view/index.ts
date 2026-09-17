/**
 * 视图渲染入口（1.x view/index.js 的 Vue3 形态：createApp + 全局属性）。
 */
import { createApp, type App as VueApp } from "vue";
import TwikooApp from "./App.vue";
import { setAppState } from "../utils/api";

/** 应用实例缓存（重复 init 时先卸载） */
let app: VueApp | null = null;

/**
 * 渲染评论区（§5.1：createApp(App).mount(el)；全局属性 $tcb/$twikoo 注入）。
 * @param tcb 云开发实例
 * @param options 前端选项
 * @returns 应用实例
 */
export function render(tcb: unknown, options: Record<string, unknown> = {}): VueApp {
  if (app) {
    app.unmount();
    app = null;
  }
  app = createApp(TwikooApp);
  // §5.1：Vue2 Vue.prototype 全局属性 → Vue3 app.config.globalProperties
  app.config.globalProperties.$tcb = tcb;
  app.config.globalProperties.$twikoo = options;
  setAppState(tcb as never, options);
  app.mount((options.el as string) || "#twikoo");
  return app;
}

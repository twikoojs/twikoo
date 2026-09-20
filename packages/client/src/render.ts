/**
 * 渲染入口（createApp + 全局属性注入）。
 *
 * 2.0 不再有 `view/` 层——twikoo 没有 router，视图层没有意义，组件与入口在 `src/` 下平铺
 * （1.x 对应文件为 `src/client/view/index.js`）。与 1.x 的差异：
 * - 1.x 在那里 `Vue.use(Button/Input/Loading)` 并引入 theme-chalk；
 *   2.0 自研 `tk-*` 组件自带样式，无需全局注册（`<script setup>` 内导入即用）；
 * - `v-loading` / `v-clickoutside` 由各组件按需从 `utils/directives.ts` 导入
 *   （script setup 的 `vXxx` 命名约定即自动注册为本地指令）；
 * - OwO 面板样式（`lib/owo.css`）与 1.x 一致在渲染入口引入，随 UMD 产物输出到 twikoo.css。
 */
import { createApp, type App as VueApp } from "vue";
import TwikooApp from "./App.vue";
import { setAppState } from "./utils/api";
import "./lib/owo.css";

/** 应用实例缓存（重复 init 时先卸载） */
let app: VueApp | null = null;

/**
 * 渲染评论区（`createApp(App).mount(el)`；全局属性 $tcb/$twikoo 注入）。
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
  // Vue2 Vue.prototype 全局属性 → Vue3 app.config.globalProperties
  app.config.globalProperties.$tcb = tcb;
  app.config.globalProperties.$twikoo = options;
  setAppState(tcb as never, options);
  app.mount((options.el as string) || "#twikoo");
  return app;
}

/**
 * 取当前应用实例（测试与外部集成用；未渲染时为 null）。
 * @returns 应用实例
 */
export function getApp(): VueApp | null {
  return app;
}

import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import { runLangRedirect } from "./lang-detect";

export default {
  ...DefaultTheme,
  // override the Layout with a wrapper component that
  // injects the slots
  Layout,
  /**
   * 客户端启动钩子：进入站点时执行一次语言自动探测与跳转。
   * SSR 阶段 `window` 不存在，`runLangRedirect` 内部已守卫直接返回。
   */
  enhanceApp() {
    runLangRedirect();
  },
};

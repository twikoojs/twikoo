import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * twikoo 客户端 dev/build 基础配置（§5.2）。
 * 四产物（twikoo[.all][.nocss].min.js，UMD 全局名 twikoo）由 build.mjs 依次构建——
 * Vite lib 模式的 UMD 格式要求单入口，无法在单配置中并列四产物。
 */
export default defineConfig({
  plugins: [vue()],
});

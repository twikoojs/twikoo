import { defineConfig } from "@twikoojs/tsup-config";

/**
 * `@twikoojs/shared` 的 tsup 构建配置。
 *
 * 直接复用共享配置工厂：双格式（`.mjs` + `.cjs`）+ 类型声明，并由工厂注入
 * 版本占位符替换插件与含包名/版本的 banner。
 */
export default defineConfig();

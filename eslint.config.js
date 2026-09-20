// @ts-check
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfigWithVueTs(
  {
    // 全局忽略：构建产物、覆盖率、依赖、压缩产物。
    // docs/：VitePress 文档站自带独立工具链（node_modules 内含自己的 lint 生态决策），
    // 不纳入本仓 lint 范围，由文档站自身演进节奏维护。
    name: "twikoo/ignores",
    // build/：pkg 打包的中间产物（单文件 bundle，~1.7MB），与 dist/ 同理不参与 lint
    ignores: [
      "**/*.min.js",
      "**/build/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "docs/**",
    ],
  },

  // Vue 3 flat/recommended——只作用于 .vue 文件
  pluginVue.configs["flat/recommended"],

  // TS：recommended-type-checked 语义 + projectService 自动发现各包 tsconfig
  vueTsConfigs.recommendedTypeChecked,

  {
    // 运行环境 globals：browser（client）+ node（服务端/适配器）合并全开。
    // 选择记录：client 尚无源码，按目录划分在此阶段收益低；接入 client 后
    // 如需严格划分（例如服务端禁 window）再加 per-directory 覆盖。
    name: "twikoo/globals",
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    // 配置文件与测试文件不需要 type-aware 规则——且多数不在任何 tsconfig 项目内
    name: "twikoo/skip-typecheck-configs-and-tests",
    files: ["**/*.config.ts", "**/*.config.mts", "**/test/**"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // pushoo：独立仓库迁入的历史源码（旧 eslint 8 + airbnb 工具链）
  {
    name: "twikoo/pushoo-legacy-defer",
    files: ["packages/pushoo/**"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    // 一键部署模板（templates/**）是按平台要求写的 CommonJS：云平台只做「克隆目录 →
    // npm install → 直接加载入口」，没有构建步骤（详见 templates/README.md），
    // 因此 require() 是必需品而非待迁移写法，关掉该规则。
    name: "twikoo/templates-are-cjs-by-design",
    files: ["templates/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // 关闭所有格式类规则，格式交给 Prettier（.prettierrc.json）
  eslintConfigPrettier,
);

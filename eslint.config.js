// @ts-check
/**
 * ESLint 9 flat 配置（T7）。
 *
 * 分层（自上而下）：
 *  1. 全局 ignores
 *  2. Vue 3 flat/recommended（eslint-plugin-vue）
 *  3. TypeScript recommended-type-checked（@vue/eslint-config-typescript v14，
 *     projectService: true 自动发现各包 tsconfig——T11 已 15/15 就位）
 *  4. 运行环境 globals（browser + node）
 *  5. 配置文件/测试文件跳过 type-aware 规则
 *  6. pushoo 迁入源码过渡放宽（T47 收敛）
 *  7. eslint-config-prettier 末层关闭格式类规则（格式由 Prettier 单一职责）
 *
 * 重写模式说明：client 尚无源码，本配置直接按 Vue 3 设定，无任何 Vue2 过渡降级；
 * T27 接入 client 组件时天然 Vue3。
 */
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfigWithVueTs(
  {
    // 1. 全局忽略：构建产物、覆盖率、依赖、压缩产物。
    //    docs/：VitePress 文档站自带独立工具链（node_modules 内含自己的 lint 生态决策），
    //    不纳入本仓 lint 范围，由文档站自身演进节奏维护。
    name: "twikoo/ignores",
    ignores: ["**/dist/**", "coverage/**", "**/node_modules/**", "docs/**", "**/*.min.js"],
  },

  // 2. Vue 3 flat/recommended——只作用于 .vue 文件
  pluginVue.configs["flat/recommended"],

  // 3. TS：recommended-type-checked 语义 + projectService 自动发现各包 tsconfig
  vueTsConfigs.recommendedTypeChecked,

  {
    // 4. 运行环境 globals：browser（client）+ node（服务端/适配器）合并全开。
    //    选择记录：client 尚无源码，按目录划分在此阶段收益低；T27 接入 client 后
    //    如需严格划分（例如服务端禁 window）再加 per-directory 覆盖。
    name: "twikoo/globals",
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    // 5. 配置文件与测试文件不需要 type-aware 规则——且多数不在任何 tsconfig 项目内
    //    （根 vitest.config.ts、packages/shared/vitest.config.ts、packages/*/test/**；
    //    tsconfig 由 T11 冻结，不在本任务范围改动）。
    //    纯 .js 文件（含本文件）由 @vue/eslint-config-typescript 自动套 disableTypeChecked。
    name: "twikoo/skip-typecheck-configs-and-tests",
    files: ["**/*.config.ts", "**/test/**"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // 6. pushoo：独立仓库迁入的历史源码（旧 eslint 8 + airbnb 工具链）。
  //    flat 配置天然不读其旧 .eslintrc；此 override 关闭 type-aware 规则以避免迁移告警，
  //    待 T47 专项收敛后移除本段。
  {
    name: "twikoo/pushoo-legacy-defer",
    files: ["packages/pushoo/**"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // 首跑实测 5 处 no-explicit-any（115/164/422/441/663 行）——迁入代码遗留；
      // T47 收敛时改为显式类型并恢复此规则。
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 6b. 冻结占位文件的既知告警（文件内容属其他 T 任务范围，本任务不得改动）：
  //     告警均为有意保留，规则局部关闭并注明重审条件。
  {
    // COVERAGE_THRESHOLDS 为覆盖率阈值占位（见该文件头注释：Wave 2/4 接线后移入各包配置）
    name: "twikoo/allow-frozen-vitest-config",
    files: ["vitest.config.ts"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
  {
    // tsup onSuccess 钩子签名要求 async 但暂无 await；打包流水线（pkg 波次）接入时重审
    name: "twikoo/allow-tsup-onSuccess-no-await",
    files: ["packages/tsup-config/src/index.ts"],
    rules: { "@typescript-eslint/require-await": "off" },
  },

  // 7. 末层：关闭所有格式类规则，格式交给 Prettier（.prettierrc.json）
  eslintConfigPrettier,
);

// @ts-check
/**
 * ESLint 9 flat 配置。
 *
 * 分层（自上而下）：
 *  1. 全局 ignores
 *  2. Vue 3 flat/recommended（eslint-plugin-vue）
 *  3. TypeScript recommended-type-checked（@vue/eslint-config-typescript v14，
 *     projectService: true 自动发现各包 tsconfig）
 *  4. 运行环境 globals（browser + node）
 *  5. 配置文件/测试文件跳过 type-aware 规则
 *  6. pushoo 迁入源码过渡放宽
 *  7. eslint-config-prettier 末层关闭格式类规则（格式由 Prettier 单一职责）
 *  8. 强制规则四件套（位于 prettier 末层之前）：
 *     ① jsdoc/require-jsdoc——函数/类方法/对象方法/箭头函数常量/导出常量必须带注释
 *     ② 本地规则 twikoo/no-scoped-style——禁 <style scoped>
 *     ③ no-restricted-imports（仅 server-common）——重依赖顶层静态 import 禁令
 *     （规则二「禁新 .js 源码」为人工约定，无自动守卫）
 *  8b. templates/**（一键部署模板）按平台要求写 CommonJS，豁免 no-require-imports
 *  9. 测试目录疑似密钥字面量禁令（.env 机制配套，同在 prettier 末层之前）
 *
 * 重写模式说明：client 尚无源码，本配置直接按 Vue 3 设定，无任何 Vue2 过渡降级；
 * client 组件接入时天然就是 Vue3。
 */
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";

/**
 * 规则一：jsdoc/require-jsdoc 公共选项——覆盖函数声明、类方法、
 * 箭头函数赋值常量、对象方法、导出常量（export const）。
 *
 * 设计要点：
 * - 匿名回调/函数实参（如 `setTimeout(() => {}, 0)`）不在任何 contexts 内，天然豁免；
 * - 注释语言不做机器校验（AGENTS.md 已规定中文）；
 * - require-jsdoc 会沿 AST 祖先链查找注释，`export const X = ...` 的注释写在
 *   export 关键字上方即可命中。
 * @type {import("eslint-plugin-jsdoc").eslintPluginJsdocConfigs["require-jsdoc"][1]}
 */
const jsdocRequireOptions = {
  require: {
    FunctionDeclaration: true,
    MethodDefinition: true,
    ArrowFunctionExpression: false,
    FunctionExpression: false,
    ClassDeclaration: false,
    ClassExpression: false,
  },
  contexts: [
    // 箭头函数赋值常量（const x = () => {}）
    "VariableDeclarator > ArrowFunctionExpression",
    // 对象字面量方法：method shorthand 与属性值为箭头函数
    "Property > FunctionExpression",
    "Property > ArrowFunctionExpression",
    // 导出常量（export const/let/var X = ...，含非函数初始化）。
    // 注意：不能用 `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator`——
    // require-jsdoc 的注释查找对 VariableDeclarator 只看其前一个 token（`const` 关键字），
    // 沿祖先链回溯仅对函数类节点生效，写在 export 上方的注释会漏检（实测）。
    // 直接匹配 ExportNamedDeclaration 节点本身，其 token-before 即为 jsdoc 块。
    "ExportNamedDeclaration[declaration.type='VariableDeclaration']",
  ],
};

/**
 * tsup-config 过渡期专用：同上但去掉对象方法两个 contexts（存量对象字面量方法
 * 无独立注释，见下方 override 段说明）；其余检查保持生效。
 * @type {typeof jsdocRequireOptions}
 */
const jsdocRequireOptionsNoProperty = {
  require: jsdocRequireOptions.require,
  contexts: jsdocRequireOptions.contexts.filter((c) => !c.startsWith("Property")),
};

/** 规则四：重依赖统一提示语（动态加载 + 适配器声明缺失依赖）。*/
const heavyDepMessage =
  "重依赖禁止顶层静态 import：请用 await import() 动态加载，缺失依赖在适配器声明。";

/**
 * 规则三本地规则：禁 <style scoped>（AGENTS.md CSS 规范——样式全局化，
 * 类名 tk- 前缀，作用域挂 .twikoo 根选择器）。
 *
 * 为什么不用 vue/no-restricted-block：实测 eslint-plugin-vue 10.11.0 该规则按
 * VElement.rawName 匹配，<style scoped> 的 rawName 是 "style"（scoped 只是
 * startTag 属性），element 选项目无法表达「带 scoped 修饰的 style 块」；
 * 而 element: "style" 会把普通 <style> 块一并禁掉，与 AGENTS.md「所有样式
 * 写在 <style> 块内」矛盾。故以本地规则检查顶层 <style> 块的 scoped 属性。
 */
const noScopedStyleRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow <style scoped> blocks (AGENTS.md CSS rules)." },
    schema: [],
    messages: {
      noScoped:
        "禁止 <style scoped>：所有样式写在非 scoped <style> 块内，类名用 tk- 前缀并以 .twikoo 根选择器限定作用域（见 AGENTS.md CSS 规范）。",
    },
  },
  /**
   * 规则实现：在 SFC 顶层块中查找带 scoped 静态属性的 style 块。
   * @param {import("eslint").Rule.RuleContext} context ESLint 规则上下文
   * @returns {import("eslint").Rule.RuleListener} 访问器
   */
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      /** 在文档片段（SFC 顶层块集合）上检查 style 块的 scoped 属性。 */
      Program() {
        const fragment = sourceCode.parserServices?.getDocumentFragment?.();
        if (!fragment) return;
        for (const child of fragment.children) {
          if (
            child.type === "VElement" &&
            child.name === "style" &&
            child.startTag.attributes.some((attr) => !attr.directive && attr.key.name === "scoped")
          ) {
            context.report({ node: child.startTag, messageId: "noScoped" });
          }
        }
      },
    };
  },
};

export default defineConfigWithVueTs(
  {
    // 1. 全局忽略：构建产物、覆盖率、依赖、压缩产物。
    //    docs/：VitePress 文档站自带独立工具链（node_modules 内含自己的 lint 生态决策），
    //    不纳入本仓 lint 范围，由文档站自身演进节奏维护。
    name: "twikoo/ignores",
    // build/：pkg 打包的中间产物（单文件 bundle，~1.7MB），与 dist/ 同理不参与 lint
    ignores: [
      "**/dist/**",
      "**/build/**",
      "coverage/**",
      "**/node_modules/**",
      "docs/**",
      "**/*.min.js",
    ],
  },

  // 2. Vue 3 flat/recommended——只作用于 .vue 文件
  pluginVue.configs["flat/recommended"],

  // 3. TS：recommended-type-checked 语义 + projectService 自动发现各包 tsconfig
  vueTsConfigs.recommendedTypeChecked,

  {
    // 4. 运行环境 globals：browser（client）+ node（服务端/适配器）合并全开。
    //    选择记录：client 尚无源码，按目录划分在此阶段收益低；接入 client 后
    //    如需严格划分（例如服务端禁 window）再加 per-directory 覆盖。
    name: "twikoo/globals",
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    // 5. 配置文件与测试文件不需要 type-aware 规则——且多数不在任何 tsconfig 项目内
    //    （根 vitest.config.ts、packages/shared/vitest.config.ts、packages/*/test/**；
    //    各包 tsconfig 的归属不在本次改动范围内）。
    //    `.mts` 变体必须一并列出：未声明 `type: "module"` 的包（pushoo 与各适配器）其
    //    tsdown 配置为 `tsdown.config.mts`（消除 Node 的 MODULE_TYPELESS_PACKAGE_JSON 告警，
    //    见 AGENTS.md「构建配置文件名」），漏掉就会被 projectService 判为「不属于任何项目」
    //    而直接解析失败。
    //    纯 .js 文件（含本文件）由 @vue/eslint-config-typescript 自动套 disableTypeChecked。
    name: "twikoo/skip-typecheck-configs-and-tests",
    files: ["**/*.config.ts", "**/*.config.mts", "**/test/**"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // 6. pushoo：独立仓库迁入的历史源码（旧 eslint 8 + airbnb 工具链）。
  //    flat 配置天然不读其旧 .eslintrc；此 override 关闭 type-aware 规则以避免迁移告警，
  //    待打包链路专项收敛后移除本段。
  {
    name: "twikoo/pushoo-legacy-defer",
    files: ["packages/pushoo/**"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // 首跑实测 5 处 no-explicit-any（115/164/422/441/663 行）——迁入代码遗留；
      // 待打包链路收敛时改为显式类型并恢复此规则。
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 6b. 冻结占位文件的既知告警（文件内容属其他 T 任务范围，本任务不得改动）：
  //     告警均为有意保留，规则局部关闭并注明重审条件。
  {
    // COVERAGE_THRESHOLDS 为覆盖率阈值占位（见该文件头注释：各包接入用例后移入其包配置）
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

  // ===== 8. 强制规则四件套（必须在 prettier 末层之前）=====

  {
    // 规则一：函数/类方法/对象方法/箭头函数常量/导出常量必须带 JSDoc 注释（AGENTS.md 硬性规则）。
    name: "twikoo/jsdoc-required-on-functions",
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": ["error", jsdocRequireOptions],
    },
  },

  {
    // 规则三：禁 <style scoped>——本地规则实现（选型原因见 noScopedStyleRule 注释）。
    name: "twikoo/no-scoped-style-blocks",
    files: ["**/*.vue"],
    plugins: { twikoo: { rules: { "no-scoped-style": noScopedStyleRule } } },
    rules: {
      "twikoo/no-scoped-style": "error",
    },
  },

  {
    // 规则四：server-common 禁止顶层静态 import 重依赖（Scope F 清单，AGENTS.md 依赖规则）。
    // no-restricted-imports 只命中静态 import/require 声明，`await import()` 动态导入不受影响。
    // 适配器按需在自身 package.json dependencies 声明实际使用的重依赖；
    // @twikoojs/common 仅以 peerDependenciesMeta(optional) 声明接口约束。
    name: "twikoo/server-common-heavy-dep-top-import-ban",
    files: ["packages/server-common/src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "nodemailer",
            "jsdom",
            "dompurify",
            "@imaegoo/node-ip2region",
            "akismet-api",
            "tencentcloud-sdk-nodejs-tms",
            "form-data",
            "axios",
            "bowser",
            "marked",
            "xml2js",
            "html-to-text",
            "pushoo",
            // 数据库驱动同属重依赖：common 内只允许 await import() 动态加载
            "mongodb",
            "lokijs",
          ].map((name) => ({ name, message: heavyDepMessage })),
          patterns: [{ group: ["@xsai/*"], message: heavyDepMessage }],
        },
      ],
    },
  },

  {
    // 规则一过渡豁免：pushoo 迁入存量 8 处顶层函数无 JSDoc（checkParameters/getHtml/
    // getTxt/getTitle/removeUrlAndIp/noticePushdeer/noticeIgot/notice）。按纪律
    // 不得改其源码，pushoo 收敛时补注释并移除本段。
    name: "twikoo/pushoo-jsdoc-defer",
    files: ["packages/pushoo/**"],
    rules: { "jsdoc/require-jsdoc": "off" },
  },

  {
    // 规则一过渡豁免（收窄版）：tsup-config 存量对象字面量方法（createVersionPlugin
    // 返回对象的 setup、defineConfig 中 base/返回对象的 outExtension 与 onSuccess）
    // 无独立注释，其上层工厂函数已有完整 JSDoc。保持其余 jsdoc 检查生效，
    // 仅去掉 Property 类 contexts；pkg 波次接入时补注释后恢复完整版并移除本段。
    name: "twikoo/allow-tsup-object-methods-no-jsdoc",
    files: ["packages/tsup-config/src/index.ts"],
    rules: {
      "jsdoc/require-jsdoc": ["error", jsdocRequireOptionsNoProperty],
    },
  },

  {
    // 规则一作用域排除：scripts/** 工具脚本不属于包源码，不参与 jsdoc 强制
    // （docs/** 已在全局 ignores 中）。脚本以头部块注释自释用途，不依赖本豁免，
    // 但豁免保证未来脚本无需为此补注释。
    name: "twikoo/no-jsdoc-on-tooling-scripts",
    files: ["scripts/**"],
    rules: { "jsdoc/require-jsdoc": "off" },
  },

  {
    // 一键部署模板（templates/**）是按平台要求写的 CommonJS：云平台只做「克隆目录 →
    // npm install → 直接加载入口」，没有构建步骤（详见 templates/README.md），
    // 因此 require() 是必需品而非待迁移写法，关掉该规则。
    name: "twikoo/templates-are-cjs-by-design",
    files: ["templates/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // ===== 9. 测试目录疑似密钥字面量禁令 =====

  {
    // .env 机制配套守卫：测试代码出现疑似密钥的字符串字面量即报错，
    // 强制走环境变量 / hasEnv()（缺失时用例 skip，见 packages/shared/test/utils/env.ts
    // 与根 .env.example）。仅作用于 test 目录（含子目录）与 *.test.ts 文件——
    // 源码中的密钥属运行时用户配置数据，不在本约束面。
    // 实现选型：no-restricted-syntax 选择器正则（零本地规则代码），
    // 三形态：sk- 前缀 / AKID 前缀 / 敏感命名变量直接赋非空字符串字面量。
    name: "twikoo/test-secret-literal-ban",
    files: ["**/test/**", "**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // sk- 前缀（OpenAI / Anthropic 等风格 API Key）且主体足够长，避免误伤普通文案
          selector: "Literal[value=/^sk-[A-Za-z0-9][A-Za-z0-9_-]{15,}$/]",
          message:
            "疑似密钥字符串字面量（sk- 前缀）：请改用环境变量 / hasEnv() 读取（清单见根 .env.example）。",
        },
        {
          // AKID 前缀（云厂商 AccessKeyId 常见形态）
          selector: "Literal[value=/^AKID[A-Za-z0-9]{10,}$/]",
          message:
            "疑似密钥字符串字面量（AKID 前缀）：请改用环境变量 / hasEnv() 读取（清单见根 .env.example）。",
        },
        {
          // password/secret/token/key/credential 语义命名的变量直接赋 ≥8 字符字符串字面量
          // （长度门槛压低误伤面：短文案/枚举值不触发）。
          // 大小写逐字符枚举而非 [Kk]ey 式首字母枚举：实测 const KEY（全大写，
          // 测试中硬编码密钥最常见命名形态）漏检——每字母双写覆盖 Camel 与 SCREAMING。
          // esquery 无处用 flag 语法，枚举是确定性实现。
          selector:
            "VariableDeclarator[id.name=/([Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Pp][Aa][Ss][Ss][Ww][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Kk][Ee][Yy]|[Aa][Pp][Ii]_?[Kk][Ee][Yy]|[Aa][Cc][Cc][Ee][Ss][Ss]_?[Kk][Ee][Yy]|[Cc][Rr][Ee][Dd][Ee][Nn][Tt][Ii][Aa][Ll])/] > Literal[value=/^.{8,}$/]",
          message:
            "疑似密钥赋值（敏感命名字符串字面量）：请改用环境变量 / hasEnv() 读取（清单见根 .env.example）。",
        },
      ],
    },
  },

  // 7. 末层：关闭所有格式类规则，格式交给 Prettier（.prettierrc.json）
  eslintConfigPrettier,
);

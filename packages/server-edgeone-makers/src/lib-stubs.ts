/**
 * 重依赖占位桩（**仅构建期使用**，见 `tsdown.config.ts` 的 `alias`）。
 *
 * **为什么需要**：`@twikoojs/common` 的 `lib-loader` 把重依赖写成
 * `xxx: () => import("nodemailer")` 这类**字面量 thunk**（AGENTS.md 的「specifier 必须写
 * 字面量」纪律）。本适配器通过 `setCustomLibs` 覆写与能力关闭，让这些包在 EdgeOne Makers
 * 上**运行时永不加载**，因此它们既未安装、也不该装进来（jsdom / mongodb 体积巨大）。
 *
 * 但平台侧 `edgeone makers build` 会用自己的打包器把函数打成单文件，遇到解析不到的
 * 动态 `import()` 会**直接构建失败**（实测）：
 *
 * ```
 * 构建 | 失败
 * ✘ [ERROR] Could not resolve "nodemailer"
 * ✘ [ERROR] Could not resolve "jsdom"
 * ```
 *
 * 故在**本包构建期**把这些 specifier 别名到本文件，产物里就不再有解析不到的路径。
 * 本文件不导出任何东西：这些包若真的被调用，说明覆写/能力声明出了问题，届时会在调用点
 * 以普通 TypeError 暴露 —— 这是有意为之，不在这里兜底掩盖。
 */
export {};

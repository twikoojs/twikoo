/**
 * Twikoo 统一版本号常量（构建期占位符）。
 *
 * 声明为 `string`（而非字面量类型），使类型声明产物不残留占位符字面量：
 * 构建时由 `@twikoojs/tsdown-config` 的版本替换插件把该值改写为当前包
 * `package.json` 的 version。
 * - 本地开发构建得到 `'0.0.0'`（各发布包 version 恒为 0.0.0）；
 * - CI 发布流程先按 Release tag 注入真实版本号，再构建，产物即携带正式版本。
 *
 * 占位符字面量由 `@twikoojs/tsdown-config` 的 `VERSION_PLACEHOLDER` 常量定义，
 * 客户端与服务端统一读取本常量，避免版本号在多包之间手工同步。
 */
export const VERSION: string = "__TWIKOO_VERSION__";

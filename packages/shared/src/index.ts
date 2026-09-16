/**
 * `@twikoojs/shared` 统一出口。
 *
 * 汇总 Twikoo 2.0 各包共用的基础能力：
 * - {@link VERSION}：构建期注入的版本号（占位符机制）；
 * - {@link PUSHOO_CHANNELS} 及渠道类型：推送渠道单一事实来源（20 渠道，不含 serverchain）；
 * - 后端事件常量：Scope E 的 26 事件（含 1.x 兼容分支，共 27 个标识符）。
 *
 * 本包不引入任何运行时依赖，仅提供常量与类型。
 */
export * from "./version";
export * from "./pushoo-channels";
export * from "./events";

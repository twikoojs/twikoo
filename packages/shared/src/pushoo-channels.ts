/**
 * 推送渠道类型联合（共享层权威声明）。
 *
 * 依据 `packages/pushoo/src/index.ts` 的 `ChannelType`（只读参考依据）逐字声明，
 * 作为 2.0 各处引用推送渠道的类型来源。
 *
 * 未使用 `import type { ChannelType } from 'pushoo'` 直接派生，原因：
 * 1. `pushoo` 的分发入口是 `dist/index.js`，产物（含 `.d.ts`）尚未构建；
 * 2. 其 `ChannelType` 所在源文件顶层还会解析 axios / marked 等重依赖，跨包引入类型
 *    会把重依赖拖入 shared 的类型解析，违背「shared 零运行时依赖」的定位。
 * 因此在此声明同一联合，并通过文件末尾的编译期完备性守卫
 * （{@link PushooChannelCoverage}）保证新增/删除渠道时不会漏更新渠道清单。
 *
 * 其中 `serverchain` 是 1.x 遗留的 `serverchan` 拼写别名（仅 pushoo 内部分发兼容），
 * 2.0 新代码不得使用，派生实际渠道见 {@link ActiveChannelType}。
 */
export type ChannelType =
  | "webhook"
  | "qmsg"
  | "serverchan"
  | "serverchain"
  | "pushplus"
  | "pushplushxtrip"
  | "dingtalk"
  | "wecom"
  | "bark"
  | "gocqhttp"
  | "onebot"
  | "atri"
  | "pushdeer"
  | "igot"
  | "telegram"
  | "feishu"
  | "lark"
  | "ifttt"
  | "wecombot"
  | "discord"
  | "wxpusher"
  | "ntfy"
  | "join";

/**
 * 2.0 实际支持的推送渠道类型。
 *
 * 等于 {@link ChannelType} 排除 1.x 兼容别名 `serverchain`，共 22 个渠道。
 */
export type ActiveChannelType = Exclude<ChannelType, "serverchain">;

/**
 * PUSHOO 支持的推送渠道清单（22 个，不含 `serverchain`）。
 *
 * 顺序与命名严格对齐 pushoo 的 `ChannelType`，供国际化（渠道文案键）、
 * 配置界面遍历与推送能力校验统一消费。使用 `as const satisfies` 保证
 * 每个字面量都是合法的 {@link ActiveChannelType}。
 */
export const PUSHOO_CHANNELS = [
  "webhook",
  "qmsg",
  "serverchan",
  "pushplus",
  "pushplushxtrip",
  "dingtalk",
  "wecom",
  "bark",
  "gocqhttp",
  "onebot",
  "atri",
  "pushdeer",
  "igot",
  "telegram",
  "feishu",
  "lark",
  "ifttt",
  "wecombot",
  "discord",
  "wxpusher",
  "ntfy",
  "join",
] as const satisfies readonly ActiveChannelType[];

/** 编译期完备性守卫：约束为 `never`，一旦有渠道漏列即触发约束错误 */
type EnsureAllChannelsListed<T extends never> = T;

/**
 * 渠道清单完备性断言的导出类型。
 *
 * 恒为 `never`；当 {@link PUSHOO_CHANNELS} 漏列 {@link ActiveChannelType} 中任一渠道时，
 * 被排除出的缺失成员类型不满足 `never` 约束，编译立即失败，从而强制清单与类型同步。
 */
export type PushooChannelCoverage = EnsureAllChannelsListed<
  Exclude<ActiveChannelType, (typeof PUSHOO_CHANNELS)[number]>
>;

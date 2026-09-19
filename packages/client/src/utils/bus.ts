/**
 * 组件间事件总线（1.x `app.$on/$emit` 全局事件通道的 Vue3 等价物）。
 *
 * 1.x 用 Vue2 的实例事件做跨组件通信（`app.$emit('configUpdated')`、
 * `app.$emit('initMeta')`，以及 `TkMetaInput` 直接 `this.$root.$children[0].onShowAdminEntry()`
 * 这种「拿父组件实例硬调方法」的写法）。2.0 组合式 API 下没有 this 链，改为
 * 显式事件总线；**事件名与 1.x 保持一致**，便于逐条对照迁移前后行为。
 *
 * 使用约束：仅承载「广播语义」的事件（配置已更新、meta 已重置、管理入口显隐）。
 * 组件间的父子数据流仍走 props/emits，避免总线滥用。
 */

/** 事件处理器 */
type Handler = (...args: unknown[]) => void;

/** 事件名 → 处理器集合 */
const handlers = new Map<string, Set<Handler>>();

/** 配置已更新（1.x `configUpdated`：管理面板保存配置后通知评论列表刷新） */
export const EVENT_CONFIG_UPDATED = "configUpdated";

/** meta 重置（1.x `initMeta`：管理面板写入昵称/邮箱后通知提交框重新读取草稿） */
export const EVENT_INIT_META = "initMeta";

/** 管理入口显隐（1.x `App.onShowAdminEntry`：`HIDE_ADMIN_CRYPT` 命中时显示齿轮） */
export const EVENT_SHOW_ADMIN_ENTRY = "showAdminEntry";

/**
 * 订阅事件。
 * @param event 事件名
 * @param handler 处理器
 */
export function on(event: string, handler: Handler): void {
  const set = handlers.get(event) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(event, set);
}

/**
 * 取消订阅。
 * @param event 事件名
 * @param handler 处理器
 */
export function off(event: string, handler: Handler): void {
  handlers.get(event)?.delete(handler);
}

/**
 * 广播事件（无订阅者时静默）。
 * @param event 事件名
 * @param args 事件参数
 */
export function emit(event: string, ...args: unknown[]): void {
  for (const handler of handlers.get(event) ?? []) handler(...args);
}

/** 清空全部订阅（组件整体卸载/测试隔离用） */
export function clearAll(): void {
  handlers.clear();
}

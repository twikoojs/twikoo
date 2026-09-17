/**
 * 跨组件共享状态（1.x 挂在 `Vue.prototype.$twikoo.serverConfig` 上的全局配置的等价物）。
 *
 * 1.x 有两份「服务端配置」：
 * - `GET_CONFIG`（公开子集）→ `TkComments` 持有一份作为 `config` prop 往下传；
 * - `GET_CONFIG_FOR_ADMIN`（全量）→ 写进 `Vue.prototype.$twikoo.serverConfig`，
 *   供 `TkComment`（判断 `IS_ADMIN`/`LIGHTBOX`）与 `TkAdminComment`（`HIGHLIGHT` 等）读取。
 *
 * 2.0 组合式 API 下没有原型链可写，改为本模块的 `reactive` 容器；**语义完全一致**
 * （全量配置的最后一次下发值即全局值）。
 */
import { reactive } from "vue";

/** 共享状态容器 */
const state = reactive<{
  /** 管理端全量配置（`GET_CONFIG_FOR_ADMIN` 下发） */
  serverConfig: Record<string, unknown>;
}>({
  serverConfig: {},
});

/**
 * 写入管理端全量配置。
 * @param config 配置对象
 */
export function setServerConfig(config: Record<string, unknown>): void {
  state.serverConfig = config;
}

/**
 * 读取管理端全量配置（响应式对象，组件内直接绑定即可）。
 * @returns 管理端全量配置
 */
export function getServerConfig(): Record<string, unknown> {
  return state.serverConfig;
}

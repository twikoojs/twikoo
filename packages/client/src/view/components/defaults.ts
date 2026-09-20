/**
 * 业务组件共享的 props 缺省值。
 *
 * 为什么单独成模块：多个组件的 `config` prop 缺省值都是「空配置对象」，若在
 * `withDefaults()` 里内联 `config: () => ({})`，每次求值都会新建一个对象；
 * 提取为共享常量后，各组件复用同一份只读实例（不会被改写）。
 */
import type { ServerConfig } from "../../types";

/** 空服务端配置（props 缺省值；只读共享实例，禁止写入） */
export const EMPTY_CONFIG: ServerConfig = {};

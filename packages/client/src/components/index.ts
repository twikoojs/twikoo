/**
 * `tk-*` 组件目录。
 *
 * - **基础控件**（input / button / loading / icon / error）经本文件统一导出；
 * - **业务组件**（TkComments / TkComment / TkSubmit / TkAdmin\* 等）由使用方按名直接导入，
 *   不经此 barrel。
 *
 * 2.0 起客户端没有 `view/` 层——twikoo 无 router，视图层没有意义，组件与入口都在 `src/` 下平铺。
 * 组件在 `<script setup>` 内按需 import 即可使用，无需全局注册（2.0 不引入 element-ui 式的
 * `app.use` 全量注册）。
 */
export { default as TkButton } from "./TkButton.vue";
export { default as TkInput } from "./TkInput.vue";
export { default as TkLoading } from "./TkLoading.vue";
export { default as TkIcon } from "./TkIcon.vue";
export { default as TkError } from "./TkError.vue";
export { ICONS } from "./icons";

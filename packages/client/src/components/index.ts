/**
 * `tk-*` 基础控件统一导出（自研组件层）。
 *
 * 分层约定（与 1.x 目录结构对应）：
 * - 本目录 = **基础控件**（input / button / loading / icon / error），无业务语义；
 * - `src/view/components/` = **业务组件**（TkComments / TkComment / TkSubmit / TkAdmin* 等），
 *   对应 1.x 的 `src/client/view/components/`。
 *
 * 组件在 `<script setup>` 内按需 import 即可使用，无需全局注册（2.0 不引入
 * element-ui 式的 `app.use` 全量注册）。
 */
export { default as TkButton } from "./TkButton.vue";
export { default as TkInput } from "./TkInput.vue";
export { default as TkLoading } from "./TkLoading.vue";
export { default as TkIcon } from "./TkIcon.vue";
export { default as TkError } from "./TkError.vue";
export { ICONS } from "./icons";

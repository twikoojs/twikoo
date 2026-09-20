<!--
  tk-button（参考 Element UI Button 改写，纯 tk- 类名；组合式 API）。

  Props：type（primary / default / info / text）/ size（large / default / small / mini）/
  disabled / loading / nativeType。

  类名映射（1.x `.el-*` → 2.0 `.tk-*`）：`.el-button` → `.tk-button`；
  `.el-button--primary|--info|--text|--mini|...` → `.tk-button--primary|--info|--text|--mini|...`；
  状态类 `is-disabled` / `is-loading` 与 1.x 同名保留（三处高危点之一：复合状态类选择器）。
-->
<template>
  <button
    class="tk-button"
    :class="[
      type !== 'default' ? `tk-button--${type}` : '',
      size ? `tk-button--${size}` : '',
      { 'is-disabled': disabled, 'is-loading': loading },
    ]"
    :disabled="disabled || loading"
    :type="nativeType"
    @click="handleClick"
  >
    <TkIcon v-if="loading" name="spinner" class="tk-button__spinner" />
    <span class="tk-button__label"><slot></slot></span>
  </button>
</template>

<script setup lang="ts">
import TkIcon from "./TkIcon.vue";

/** 按钮视觉类型 */
const props = withDefaults(
  defineProps<{
    /** 视觉类型（`text` 为无边框文字按钮，`info` 为中性色按钮） */
    type?: "primary" | "default" | "info" | "text";
    /** 尺寸（mini 与 small 有可见差异）*/
    size?: "large" | "mini" | "small" | "default" | "";
    disabled?: boolean;
    loading?: boolean;
    /** 原生 type */
    nativeType?: "button" | "submit" | "reset";
  }>(),
  { type: "default", size: "", disabled: false, loading: false, nativeType: "button" },
);

/** 点击事件（禁用/加载中不触发） */
const emit = defineEmits<{ (e: "click", evt: MouseEvent): void }>();

/**
 * 点击转发（禁用/加载中不触发）。
 * @param evt 点击事件
 */
function handleClick(evt: MouseEvent): void {
  if (props.disabled || props.loading) return;
  emit("click", evt);
}
</script>

<style>
.twikoo .tk-button {
  display: inline-block;
  padding: 0 15px;
  height: 32px;
  line-height: 1;
  font-size: 0.875rem;
  border-radius: 4px;
  border: 1px solid rgba(144, 147, 153, 0.31);
  background-color: rgba(144, 147, 153, 0.063);
  color: currentColor;
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
}
.twikoo .tk-button:not(.tk-button--primary):not(.tk-button--text):not(.is-disabled):active,
.twikoo .tk-button:not(.tk-button--primary):not(.tk-button--text):not(.is-disabled):focus,
.twikoo .tk-button:not(.tk-button--primary):not(.tk-button--text):not(.is-disabled):hover {
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.063);
  border-color: rgba(64, 158, 255, 0.5);
}
.twikoo .tk-button--primary {
  background: #409eff;
  border-color: #409eff;
  color: #ffffff;
}
.twikoo .tk-button--primary:not(.is-disabled):focus,
.twikoo .tk-button--primary:not(.is-disabled):hover {
  background: #66b1ff;
  border-color: #66b1ff;
  color: #ffffff;
}
/*
 * 主按钮的**按下**态：element-ui 用独立的 `.el-button--primary:active{background:#3a8ee6}`，
 * 比悬停的 #66b1ff 更深，形成「按下去」的反馈。1.x 的覆盖段带 `:not(.el-button--primary)`，
 * 特意把主按钮排除在外，所以这条在 v1 里**是生效的**，必须单独还原。
 */
.twikoo .tk-button--primary:not(.is-disabled):active {
  background: #3a8ee6;
  border-color: #3a8ee6;
  color: #ffffff;
}
.twikoo .tk-button--primary.is-disabled,
.twikoo .tk-button--primary.is-disabled:active,
.twikoo .tk-button--primary.is-disabled:focus,
.twikoo .tk-button--primary.is-disabled:hover {
  color: rgba(255, 255, 255, 0.63);
  background-color: rgba(64, 158, 255, 0.5);
  border-color: transparent;
}
/*
 * `type="info"` 对齐 1.x 的**实际渲染结果**，而不是 element-ui 的原始值。
 *
 * 1.x 的覆盖段 `.twikoo .el-button:not(.el-button--primary):not(.el-button--text)`
 * 含 4 个类（特异性 0,4,0），高于 element-ui 的 `.el-button--info`（0,1,0，连
 * `:focus`/`:hover`/`.is-disabled` 也只有 0,2,0~0,3,0），所以 info 按钮在 v1 里
 * 从头到尾都渲染成「默认按钮」：半透明灰底 + currentColor + 常规边框。
 * 保持这里的取值与 `.tk-button` 基础规则一致，就是为了复现这个结果。
 */
.twikoo .tk-button--info {
  color: currentColor;
  background-color: rgba(144, 147, 153, 0.063);
  border-color: rgba(144, 147, 153, 0.31);
}
/*
 * 尺寸与类型修饰符的**顺序**照 element-ui 原样：尺寸在前、`--text` 在后。
 * 因为尺寸类用的是 `padding` 简写（会一并重置纵向/横向），`--text` 只清左右内边距
 * （`padding-left/right: 0`），必须排在后面才能生效，否则会被尺寸类覆盖回去——
 * 那正是「mini 按钮本该 `7px 0`、却变成 `0 7px`」的原因。
 *
 * 取值对齐 1.x element-ui 的**实际渲染值**（`.el-button--small` 与 `--mini` 在 1.x 共用
 * 同一条规则 `{ font-size: 12px; border-radius: 3px }`，padding 分别 `9px 15px` / `7px 15px`）：
 * 12px 字号 + 1px 边框下，small 高 32px、mini 高 28px。
 */
.twikoo .tk-button--large {
  height: auto;
  padding: 13px 20px;
  font-size: 1rem;
}
.twikoo .tk-button--small {
  height: auto;
  padding: 9px 15px;
  font-size: 0.75rem;
  border-radius: 3px;
}
.twikoo .tk-button--mini {
  height: auto;
  padding: 7px 15px;
  font-size: 0.75rem;
  border-radius: 3px;
}
.twikoo .tk-button--text {
  border-color: transparent;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
  color: #409eff;
}
.twikoo .tk-button--text:not(.is-disabled):focus,
.twikoo .tk-button--text:not(.is-disabled):hover {
  color: #66b1ff;
  background: transparent;
}
/*
 * 文字按钮的**按下**态：同主按钮，element-ui 有独立的 `.el-button--text:active{color:#3a8ee6}`，
 * 且 1.x 的覆盖段用 `:not(.el-button--text)` 排除在外 → v1 里生效。管理面板的查看/隐藏/
 * 置顶/删除都是这一类，缺了它按下去就没有任何反馈。
 */
.twikoo .tk-button--text:not(.is-disabled):active {
  color: #3a8ee6;
}
.twikoo .tk-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.twikoo .tk-button.is-loading {
  pointer-events: none;
  opacity: 0.7;
  cursor: wait;
}
.twikoo .tk-button__spinner {
  margin-right: 4px;
}
.twikoo .tk-button__spinner svg {
  animation: tk-spin 0.8s linear infinite;
}
/*
 * 相邻按钮间距：1.x element-ui 里是 `.el-button + .el-button { margin-left: 10px }`，
 * 这里取与本组件 `.tk-meta-input .tk-input + .tk-input` 一致的 0.5rem，保持站内统一。
 * （`.tk-row.actions` 是 flex，元素间的模板空白本来就被忽略，间距只能靠 margin 给。）
 */
.twikoo .tk-button + .tk-button {
  margin-left: 0.5rem;
}
/* 输入框 append 插槽内的按钮：与输入框合为一体（1.x element-ui 行为） */
.twikoo .tk-input-group__append .tk-button {
  height: 100%;
  margin: -1px -1rem;
  border: 0;
  border-radius: 0 3px 3px 0;
  background: transparent;
  color: currentColor;
}
.twikoo .tk-input-group__append .tk-button:hover {
  color: #409eff;
}
@keyframes tk-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<!--
  tk-button（参考 Element UI Button 改写，D-1：纯 tk- 类名；组合式 API）。

  Props：type（primary / default / info / text）/ size（large / default / small / mini）/
  disabled / loading / nativeType。

  类名映射（1.x `.el-*` → 2.0 `.tk-*`，§5.3.3）：`.el-button` → `.tk-button`；
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
    /** 尺寸（mini 与 small 有可见差异，§5.3） */
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
.twikoo .tk-button--primary:not(.is-disabled):active,
.twikoo .tk-button--primary:not(.is-disabled):focus,
.twikoo .tk-button--primary:not(.is-disabled):hover {
  background: #66b1ff;
  border-color: #66b1ff;
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
.twikoo .tk-button--info {
  color: #ffffff;
  background-color: #909399;
  border-color: #909399;
}
.twikoo .tk-button--text {
  border-color: transparent;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
  color: #409eff;
}
.twikoo .tk-button--text:not(.is-disabled):hover {
  color: #66b1ff;
  background: transparent;
}
.twikoo .tk-button--large {
  height: 40px;
  font-size: 0.9375rem;
}
.twikoo .tk-button--small {
  height: 28px;
  padding: 0 11px;
  font-size: 0.8125rem;
}
.twikoo .tk-button--mini {
  height: 24px;
  padding: 0 7px;
  font-size: 0.75rem;
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

<!--
  tk-button（参考 Element UI Button 改写，D-1：纯 tk- 类名；组合式 API）。
  Props：type（primary/default）/ size（mini/small/default）/ disabled / loading / native type。
-->
<template>
  <button
    class="tk-button"
    :class="[
      type === 'primary' ? 'tk-button--primary' : '',
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
    type?: "primary" | "default";
    /** 尺寸（mini 与 small 有可见差异，§5.3） */
    size?: "mini" | "small" | "default" | "";
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
  padding: 8px 15px;
  font-size: 0.875rem;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  cursor: pointer;
  transition: opacity 0.2s;
}
.twikoo .tk-button--primary {
  background: #12addb;
  border-color: #12addb;
  color: #fff;
}
.twikoo .tk-button--small {
  padding: 6px 11px;
  font-size: 0.8125rem;
}
.twikoo .tk-button--mini {
  padding: 4px 8px;
  font-size: 0.75rem;
}
.twikoo .tk-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.twikoo .tk-button.is-loading {
  opacity: 0.7;
  cursor: wait;
}
.twikoo .tk-button__spinner {
  margin-right: 4px;
  animation: tk-spin 0.8s linear infinite;
}
.twikoo .tk-button__spinner svg {
  animation: tk-spin 0.8s linear infinite;
}
@keyframes tk-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

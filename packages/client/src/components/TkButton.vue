<!--
  tk-button（参考 Element UI Button 改写，D-1：纯 tk- 类名；MIT NOTICE 随包声明）。
  Props：type（primary/default）/ size（mini/small/default）/ disabled / loading / native type。
-->
<template>
  <button
    class="tk-button"
    :class="[
      type ? `tk-button--${type}` : '',
      size ? `tk-button--${size}` : '',
      { 'is-disabled': disabled, 'is-loading': loading },
    ]"
    :disabled="disabled || loading"
    :type="nativeType"
    @click="handleClick"
  >
    <span v-if="loading" class="tk-button__spinner"></span>
    <span class="tk-button__label"><slot></slot></span>
  </button>
</template>

<script lang="ts">
/** 按钮点击事件 */
export default {
  name: "TkButton",
  props: {
    /** 视觉类型 */
    type: { type: String, default: "default" },
    /** 尺寸（mini 与 small 有可见差异，§5.3） */
    size: { type: String, default: "" },
    /** 是否禁用 */
    disabled: { type: Boolean, default: false },
    /** 是否加载中 */
    loading: { type: Boolean, default: false },
    /** 原生 type */
    nativeType: { type: String, default: "button" },
  },
  emits: ["click"],
  methods: {
    /** 点击转发（禁用/加载中不触发） */
    handleClick(evt: MouseEvent): void {
      if (this.disabled || this.loading) return;
      this.$emit("click", evt);
    },
  },
};
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
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  margin-right: 4px;
  animation: tk-spin 0.8s linear infinite;
}
@keyframes tk-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

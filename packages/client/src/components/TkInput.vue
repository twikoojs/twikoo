<!--
  tk-input（参考 Element UI Input 改写；v-model + textarea + 字数统计 + focus()；组合式 API）。
-->
<template>
  <div class="tk-input" :class="{ 'is-disabled': disabled }">
    <textarea
      v-if="type === 'textarea'"
      ref="inputRef"
      class="tk-input__inner tk-textarea__inner"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :maxlength="maxlength"
      @input="handleInput"
    ></textarea>
    <input
      v-else
      ref="inputRef"
      class="tk-input__inner"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      @input="handleInput"
    />
    <span v-if="showWordLimit && maxlength" class="tk-input__count">
      {{ (modelValue ?? "").length }}/{{ maxlength }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

withDefaults(
  defineProps<{
    /** v-model 值 */
    modelValue?: string;
    type?: string;
    placeholder?: string;
    /** textarea 行数 */
    rows?: number;
    disabled?: boolean;
    /** 最大长度（字数统计用） */
    maxlength?: number;
    /** 显示字数统计 */
    showWordLimit?: boolean;
  }>(),
  {
    modelValue: "",
    type: "text",
    placeholder: "",
    rows: 3,
    disabled: false,
    // 显式 undefined：语义不变（未传即不限长），仅为满足 vue/require-default-prop
    maxlength: undefined,
    showWordLimit: false,
  },
);

/** v-model 与 input 事件 */
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "input", value: string): void;
  (e: "blur", evt: FocusEvent): void;
}>();

/** 原生输入框引用（focus() 用） */
const inputRef = ref<HTMLInputElement | HTMLTextAreaElement>();

/**
 * 输入转发（v-model）。
 * @param evt 输入事件
 */
function handleInput(evt: Event): void {
  const value = (evt.target as HTMLInputElement).value;
  emit("update:modelValue", value);
  emit("input", value);
}

/**
 * 聚焦（1.x focus() 方法对齐，供父组件经 ref 调用）。
 */
function focus(): void {
  inputRef.value?.focus();
}

/**
 * 失焦转发。
 * @param evt 失焦事件
 */
function handleBlur(evt: FocusEvent): void {
  emit("blur", evt);
}

defineExpose({ focus, handleBlur });
</script>

<style>
.twikoo .tk-input {
  position: relative;
  display: inline-block;
  width: 100%;
}
.twikoo .tk-input__inner {
  display: inline-block;
  width: 100%;
  padding: 8px 12px;
  font-size: 0.875rem;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  color: #606266;
  background: #fff;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}
.twikoo .tk-input__inner:focus {
  border-color: #12addb;
}
.twikoo .tk-textarea__inner {
  min-height: 66px;
  resize: vertical;
}
.twikoo .tk-input.is-disabled .tk-input__inner {
  background: #f5f7fa;
  cursor: not-allowed;
}
.twikoo .tk-input__count {
  position: absolute;
  right: 10px;
  bottom: 5px;
  font-size: 0.75rem;
  color: #909399;
  background: #fff;
}
</style>

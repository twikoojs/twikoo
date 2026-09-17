<!--
  tk-input（参考 Element UI Input 改写；v-model + textarea + 字数统计 + focus()）。
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
      {{ String(modelValue || "").length }}/{{ maxlength }}
    </span>
  </div>
</template>

<script lang="ts">
export default {
  name: "TkInput",
  props: {
    /** v-model 值 */
    modelValue: { type: String, default: "" },
    /** 输入类型 */
    type: { type: String, default: "text" },
    /** 占位文本 */
    placeholder: { type: String, default: "" },
    /** textarea 行数 */
    rows: { type: Number, default: 3 },
    /** 是否禁用 */
    disabled: { type: Boolean, default: false },
    /** 最大长度（字数统计用） */
    maxlength: { type: Number, default: undefined },
    /** 显示字数统计 */
    showWordLimit: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "input", "focus", "blur"],
  methods: {
    /** 输入转发（v-model） */
    handleInput(evt: Event): void {
      const value = (evt.target as HTMLInputElement).value;
      this.$emit("update:modelValue", value);
      this.$emit("input", value);
    },
    /** 聚焦（1.x focus() 方法对齐） */
    focus(): void {
      (this.$refs.inputRef as HTMLInputElement | undefined)?.focus();
    },
    /** 失焦转发 */
    handleBlur(evt: FocusEvent): void {
      this.$emit("blur", evt);
    },
  },
};
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

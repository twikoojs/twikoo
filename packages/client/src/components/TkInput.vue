<!--
  tk-input（参考 Element UI Input 改写；组合式 API）。

  能力面（能力表 + 1.x 各处用法实测）：v-model / placeholder / size /
  textarea（rows、autosize、show-word-limit）/ show-password / clearable /
  prepend·append 具名插槽 / disabled / readonly / maxlength / type=number /
  focus() / 原生 textarea 元素暴露（OwO 面板与日志滚动需要）。

  类名映射（1.x `.el-*` → 2.0 `.tk-*`）：
  `.el-input` → `.tk-input`；`.el-textarea` → `.tk-textarea`（textarea 形态下同时具备，
  便于沿用 1.x 的 `.el-textarea .el-input__count` 后代选择器语义）；
  `.el-input__inner` / `.el-textarea__inner` → `.tk-input__inner`（textarea 同时带
  `.tk-textarea__inner`）；`.el-input-group__prepend/__append` →
  `.tk-input-group__prepend/__append`；`.el-input__count` → `.tk-input__count`。
-->
<template>
  <div
    class="tk-input"
    :class="[
      size ? `tk-input--${size}` : '',
      type === 'textarea' ? 'tk-textarea' : '',
      { 'is-disabled': disabled, 'tk-input--group': hasPrepend || hasAppend },
    ]"
  >
    <div v-if="hasPrepend" class="tk-input-group__prepend">
      <slot name="prepend"></slot>
    </div>
    <textarea
      v-if="type === 'textarea'"
      ref="inputRef"
      class="tk-input__inner tk-textarea__inner"
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      @input="handleInput"
      @change="handleChange"
      @blur="handleBlur"
      @focus="handleFocus"
    ></textarea>
    <input
      v-else
      ref="inputRef"
      class="tk-input__inner"
      :type="nativeType"
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      :min="min"
      :max="max"
      @input="handleInput"
      @change="handleChange"
      @blur="handleBlur"
      @focus="handleFocus"
    />
    <span v-if="showSuffix" class="tk-input__suffix">
      <i
        v-if="clearable && !disabled && !readonly && hasValue"
        class="tk-input__icon tk-input__clear"
        @click="handleClear"
      >
        <TkIcon name="circle-xmark" />
      </i>
      <i
        v-if="showPassword && type === 'password'"
        class="tk-input__icon tk-input__password"
        @click="passwordVisible = !passwordVisible"
      >
        <TkIcon :name="passwordVisible ? 'eye' : 'eye-slash'" />
      </i>
    </span>
    <span v-if="showWordLimit && maxlength" class="tk-input__count">
      {{ currentLength }}/{{ maxlength }}
    </span>
    <div v-if="hasAppend" class="tk-input-group__append">
      <slot name="append"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useSlots, watch } from "vue";
import TkIcon from "./TkIcon.vue";

/** 组件属性 */
const props = withDefaults(
  defineProps<{
    /** v-model 值 */
    modelValue?: string | number;
    /** 输入形态（`textarea` 走多行） */
    type?: string;
    placeholder?: string;
    /** textarea 行数（autosize 时作为最小行数） */
    rows?: number;
    /** 自适应高度（true 或用 `{ minRows }` 指定最小行数） */
    autosize?: boolean | { minRows?: number };
    disabled?: boolean;
    readonly?: boolean;
    /** 最大长度（showWordLimit 时用于字数统计） */
    maxlength?: number;
    /** 显示字数统计 */
    showWordLimit?: boolean;
    /** 密码显隐切换 */
    showPassword?: boolean;
    /** 可一键清空 */
    clearable?: boolean;
    /** 尺寸（mini/small 有可见差异）*/
    size?: "" | "large" | "default" | "small" | "mini";
    /** 原生 name */
    name?: string;
    /** number 形态的最小值 */
    min?: number;
    /** number 形态的最大值 */
    max?: number;
  }>(),
  {
    modelValue: "",
    type: "text",
    placeholder: "",
    rows: 2,
    autosize: false,
    disabled: false,
    readonly: false,
    // 显式 undefined：语义不变（未传即不限长），仅为满足 vue/require-default-prop
    maxlength: undefined,
    showWordLimit: false,
    showPassword: false,
    clearable: false,
    size: "",
    name: "",
    min: undefined,
    max: undefined,
  },
);

/** 组件事件 */
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "input", value: string, evt: Event): void;
  (e: "change", value: string): void;
  (e: "blur", evt: FocusEvent): void;
  (e: "focus", evt: FocusEvent): void;
  (e: "clear"): void;
}>();

const slots = useSlots();

/** 原生输入框引用（focus / autosize / OwO 插入都用它） */
const inputRef = ref<HTMLInputElement | HTMLTextAreaElement>();

/** 密码是否明文显示 */
const passwordVisible = ref(false);

/** 是否有 prepend 插槽 */
const hasPrepend = computed(() => Boolean(slots.prepend));
/** 是否有 append 插槽 */
const hasAppend = computed(() => Boolean(slots.append));
/** 是否渲染后缀图标容器 */
const showSuffix = computed(
  () =>
    (props.clearable && !props.disabled && !props.readonly && hasValue.value) ||
    (props.showPassword && props.type === "password"),
);
/** 当前值是否非空 */
const hasValue = computed(
  () => props.modelValue !== "" && props.modelValue !== undefined && props.modelValue !== null,
);
/** 实际渲染的原生 type（密码显隐） */
const nativeType = computed(() => {
  if (props.type === "password") return passwordVisible.value ? "text" : "password";
  return props.type;
});
/** 字数统计的当前长度 */
const currentLength = computed(() => String(props.modelValue ?? "").length);

/**
 * 输入转发（v-model）。
 * @param evt 输入事件
 */
function handleInput(evt: Event): void {
  const value = (evt.target as HTMLInputElement).value;
  emit("update:modelValue", value);
  emit("input", value, evt);
}

/**
 * change 转发。
 * @param evt 变更事件
 */
function handleChange(evt: Event): void {
  emit("change", (evt.target as HTMLInputElement).value);
}

/**
 * 失焦转发。
 * @param evt 失焦事件
 */
function handleBlur(evt: FocusEvent): void {
  emit("blur", evt);
}

/**
 * 聚焦转发。
 * @param evt 聚焦事件
 */
function handleFocus(evt: FocusEvent): void {
  emit("focus", evt);
}

/** 点击清空：值置空并派发 clear */
function handleClear(): void {
  emit("update:modelValue", "");
  emit("clear");
  inputRef.value?.focus();
}

/**
 * 聚焦（1.x `focus()` 方法对齐，供父组件经 ref 调用）。
 */
function focus(): void {
  inputRef.value?.focus();
}

/**
 * 失焦（供父组件经 ref 调用）。
 */
function blur(): void {
  inputRef.value?.blur();
}

/**
 * 自适应高度（Element UI autosize 等价实现：先归零再按 scrollHeight 撑开）。
 */
function resizeTextarea(): void {
  const el = inputRef.value;
  if (props.type !== "textarea" || !props.autosize || !(el instanceof HTMLTextAreaElement)) return;
  const minRows =
    typeof props.autosize === "object" ? (props.autosize.minRows ?? props.rows) : props.rows;
  const styles = getComputedStyle(el);
  const lineHeight = parseFloat(styles.lineHeight) || 20;
  const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
  const minHeight = minRows * lineHeight + padding + border;
  el.style.overflow = "hidden";
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

watch(
  () => props.modelValue,
  () => {
    void nextTick(resizeTextarea);
  },
);

onMounted(() => {
  void nextTick(resizeTextarea);
});

defineExpose({ focus, blur, inputEl: inputRef });
</script>

<style>
.twikoo .tk-input {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
}
.twikoo .tk-input--group {
  display: inline-flex;
}
.twikoo .tk-input__inner {
  display: inline-block;
  width: 100%;
  padding: 0 12px;
  height: 32px;
  line-height: 32px;
  font-size: 0.875rem;
  border: 1px solid rgba(144, 147, 153, 0.31);
  border-radius: 4px;
  color: currentColor;
  background-color: transparent;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}
.twikoo .tk-input__inner:hover {
  border-color: rgba(144, 147, 153, 0.5);
}
.twikoo .tk-input__inner:focus {
  border-color: #409eff;
}
.twikoo .tk-input--large .tk-input__inner {
  height: 40px;
  line-height: 40px;
}
.twikoo .tk-input--small .tk-input__inner {
  height: 28px;
  line-height: 28px;
  font-size: 0.8125rem;
}
.twikoo .tk-input--mini .tk-input__inner {
  height: 24px;
  line-height: 24px;
  font-size: 0.75rem;
}
.twikoo .tk-textarea .tk-input__inner {
  height: auto;
  min-height: 66px;
  line-height: 1.5;
  padding: 6px 12px;
  resize: vertical;
}
.twikoo .tk-input.is-disabled .tk-input__inner {
  background-color: rgba(144, 147, 153, 0.06);
  cursor: not-allowed;
}
.twikoo .tk-input__inner[readonly] {
  cursor: default;
}
.twikoo .tk-input input:invalid {
  border-color: #f56c6c;
}
/* type=number：隐藏原生调节箭头（1.x 对分页输入框的样式保留） */
.twikoo .tk-input__inner[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
.twikoo .tk-input__inner[type="number"]::-webkit-inner-spin-button,
.twikoo .tk-input__inner[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.twikoo .tk-input__suffix {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  color: #c0c4cc;
}
.twikoo .tk-input__icon {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  line-height: 0;
}
.twikoo .tk-input__icon:hover {
  color: #909399;
}
.twikoo .tk-input__count {
  position: absolute;
  right: 10px;
  bottom: 5px;
  font-size: 0.75rem;
  /* 1.x 覆盖段把字数统计改成 currentColor（跟随正文颜色，夜间模式自动适配），
     而非 element-ui 默认的灰色 #909399 */
  color: currentColor;
  background: transparent;
}
.twikoo .tk-input-group__prepend,
.twikoo .tk-input-group__append {
  display: inline-flex;
  align-items: center;
  padding: 0 1rem;
  height: 32px;
  line-height: 32px;
  box-sizing: border-box;
  white-space: nowrap;
  color: currentColor;
  background-clip: padding-box;
  background-color: rgba(144, 147, 153, 0.13);
  border: 1px solid rgba(144, 147, 153, 0.31);
  border-radius: 4px;
}
.twikoo .tk-input-group__prepend {
  border-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.twikoo .tk-input-group__append {
  border-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.twikoo .tk-input--group .tk-input__inner {
  border-radius: 0;
}
/*
 * 输入框保留自己的左边框（与 1.x element-ui 一致）：prepend 已经去掉右边框，
 * 这条 1px 边框既是分组内的分隔线，也是聚焦时左侧那一道蓝色描边。
 * 若去掉它，聚焦态会缺左边、且与 1.x 视觉不一致。
 */
.twikoo .tk-input--small .tk-input-group__prepend,
.twikoo .tk-input--small .tk-input-group__append {
  height: 28px;
  line-height: 28px;
  font-size: 0.8125rem;
}
.twikoo .tk-input--mini .tk-input-group__prepend,
.twikoo .tk-input--mini .tk-input-group__append {
  height: 24px;
  line-height: 24px;
  font-size: 0.75rem;
}
</style>

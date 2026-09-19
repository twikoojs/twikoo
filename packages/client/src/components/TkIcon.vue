<!--
  tk-icon（用户修正：按需引入 @fortawesome/fontawesome-free/svgs/ 下的 SVG 文件，
  不用 webfont 字体——字体含全量图标会膨胀产物；组合式 API）。
-->
<template>
  <!-- SVG 内容来自 fontawesome-free 官方文件（构建期内联，非运行时注入用户数据） -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <i class="tk-icon" v-html="svg"></i>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ICONS } from "./icons";

const props = defineProps<{
  /** 图标名（icons.ts 注册表键名，如 "paper-plane"） */
  name: string;
}>();

/** 当前图标的 SVG 内容（未注册的图标为空串并告警） */
const svg = computed<string>(() => {
  const content = ICONS[props.name];
  if (!content) {
    console.warn(`[twikoo] 未注册的图标: ${props.name}（请在 components/icons.ts 登记）`);
    return "";
  }
  return content;
});
</script>

<style>
.twikoo .tk-icon {
  display: inline-block;
  line-height: 1;
}
.twikoo .tk-icon svg {
  height: 1em;
  vertical-align: -0.125em;
  fill: currentColor;
}
</style>

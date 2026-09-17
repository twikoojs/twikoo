<!--
  tk-loading（参考 Element UI Loading 指令改写：v-loading 遮罩；组合式 API）。
-->
<template>
  <div v-show="visible" class="tk-loading-mask">
    <div class="tk-loading-spinner">
      <TkIcon name="spinner" class="tk-loading-spinner__circle" />
      <p v-if="text" class="tk-loading-text">{{ text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import TkIcon from "./TkIcon.vue";

withDefaults(
  defineProps<{
    /** 是否显示遮罩 */
    visible?: boolean;
    /** 加载文案 */
    text?: string;
  }>(),
  { visible: false, text: "" },
);
</script>

<style>
.twikoo .tk-loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.twikoo .tk-loading-spinner__circle {
  color: #12addb;
  animation: tk-spin 0.8s linear infinite;
  display: inline-block;
}
.twikoo .tk-loading-spinner__circle svg {
  width: 28px;
  height: 28px;
}
.twikoo .tk-loading-text {
  color: #12addb;
  font-size: 0.8125rem;
}
@keyframes tk-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

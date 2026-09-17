<!--
  tk-loading（参考 Element UI Loading 指令改写：v-loading 遮罩）。
-->
<template>
  <div v-show="visible" class="tk-loading-mask">
    <div class="tk-loading-spinner">
      <div class="tk-loading-spinner__circle"></div>
      <p v-if="text" class="tk-loading-text">{{ text }}</p>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "TkLoading",
  props: {
    /** 是否显示遮罩 */
    visible: { type: Boolean, default: false },
    /** 加载文案 */
    text: { type: String, default: "" },
  },
};
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
  width: 28px;
  height: 28px;
  border: 3px solid #12addb;
  border-top-color: transparent;
  border-radius: 50%;
  animation: tk-spin 0.8s linear infinite;
}
.twikoo .tk-loading-text {
  color: #12addb;
  font-size: 0.8125rem;
}
</style>

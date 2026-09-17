<!--
  Twikoo 根组件（1.x App.vue 的 Vue3 组合式 API 重写）。
  布局：评论列表；样式作用域挂 .twikoo（§1.2-1，无 scoped）。
-->
<template>
  <div class="twikoo">
    <div id="twikoo-comments" class="tk-comments">
      <TkComments :key="reloadSignal" />
    </div>
    <div id="twikoo-submit" class="tk-submit-region">
      <TkSubmit :on-sent="reloadComments" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TkComments from "./components/TkComments.vue";
import TkSubmit from "../components/TkSubmit.vue";

/** 评论列表刷新通道（TkSubmit 发送成功后触发 TkComments 重载） */
const reloadSignal = ref(0);
/** 通知 TkComments 重载（key 重建） */
function reloadComments(): void {
  reloadSignal.value += 1;
}
</script>

<style>
.twikoo {
  font-size: 0.9375rem;
  color: #555;
}
.twikoo .tk-comments {
  margin-top: 1rem;
}
</style>

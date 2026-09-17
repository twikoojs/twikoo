<!--
  Twikoo 根组件（1.x App.vue 的 Vue3 组合式 API 重写）。
  布局：评论列表；样式作用域挂 .twikoo（§1.2-1，无 scoped）。
-->
<template>
  <div class="twikoo">
    <div id="twikoo-comments" class="tk-comments">
      <TkComments />
    </div>
  </div>
</template>

<script setup lang="ts">
import TkComments from "./components/TkComments.vue";
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

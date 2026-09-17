<!--
  Twikoo 根组件（1.x App.vue 的 Vue3 重写骨架）。
  布局：评论列表 + 分页 + 提交框 + 底部版权；样式作用域挂 .twikoo（§1.2-1，无 scoped）。
  tk-* 组件体系（T29）与完整交互随 T30 渐进接入；本骨架保证渲染路径与公开 API 走通。
-->
<template>
  <div class="twikoo">
    <div id="twikoo-comments" class="tk-comments">
      <TkComments :tcb="tcb" :options="options" />
    </div>
  </div>
</template>

<script lang="ts">
import TkComments from "./components/TkComments.vue";

export default {
  name: "TwikooApp",
  components: { TkComments },
  computed: {
    /** 云开发实例（全局属性注入） */
    tcb() {
      return this.$tcb;
    },
    /** 前端选项 */
    options() {
      return this.$twikoo;
    },
  },
};
</script>

<style>
/* §1.2-1：类名 tk- 前缀，作用域挂 .twikoo；禁 scoped；禁 .el-* */
.twikoo {
  font-size: 0.9375rem;
  color: #555;
}
.twikoo .tk-comments {
  margin-top: 1rem;
}
</style>

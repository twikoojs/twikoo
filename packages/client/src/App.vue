<!--
  Twikoo 根组件（1.x App.vue 的 Vue3 组合式 API 重写）。

  布局：评论区（TkComments）+ 页脚（TkFooter）+ 管理面板（TkAdmin，默认收起）。
  样式作用域挂 `.twikoo` 根选择器（禁 `<style scoped>`，类名 `tk-` 前缀）。

  1.x 的 element-ui 覆盖段（`.el-input__inner` / `.el-button` / `.el-loading-mask` /
  `.el-textarea .el-input__count`）已下沉为各组件的 `.tk-*` 基础样式——2.0 不再依赖
  theme-chalk，因此「覆盖」变成「定义」，视觉取值与 1.x 覆盖段保持一致。
-->
<template>
  <div id="twikoo" class="twikoo">
    <TkComments :show-admin-entry="showAdminEntry" @admin="showAdmin = true" />
    <TkFooter />
    <TkAdmin :show="showAdmin" @close="showAdmin = false" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import TkComments from "./components/TkComments.vue";
import TkFooter from "./components/TkFooter.vue";
import TkAdmin from "./components/TkAdmin.vue";
import { EVENT_SHOW_ADMIN_ENTRY, off as busOff, on as busOn } from "./utils/bus";

/** 管理面板是否展开 */
const showAdmin = ref(false);
/** 是否显示管理入口（由 `HIDE_ADMIN_CRYPT` 暗号命中决定） */
const showAdminEntry = ref(false);

/**
 * 处理管理入口显隐事件（1.x `App.onShowAdminEntry` 的等价物）。
 * @param show 是否显示
 */
function onShowAdminEntry(show: unknown): void {
  showAdminEntry.value = show === true;
}

onMounted(() => {
  busOn(EVENT_SHOW_ADMIN_ENTRY, onShowAdminEntry);
});

onUnmounted(() => {
  busOff(EVENT_SHOW_ADMIN_ENTRY, onShowAdminEntry);
});
</script>

<style>
.twikoo {
  position: relative;
}
.twikoo svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

/* 全局 CSS（1.x 同名保留） */
.twikoo .tk-expand {
  width: 100%;
  cursor: pointer;
  padding: 0.75em;
  text-align: center;
  transition: all 0.5s;
  box-sizing: border-box;
}
.twikoo .tk-expand:hover {
  background-color: rgba(0, 0, 0, 0.13);
}
.twikoo .tk-expand:active {
  background-color: rgba(0, 0, 0, 0.19);
}
.twikoo .tk-content img {
  max-width: 300px;
  max-height: 300px;
  vertical-align: middle;
}
.twikoo .tk-owo-emotion,
.twikoo .OwO-item img {
  width: 3em;
  height: auto;
  vertical-align: middle;
}
.twikoo .tk-admin-warn {
  padding: 1rem 1.5rem;
  background-color: #fff7d0;
  border-left: 0.5rem solid #e7c000;
  color: #6b5900;
  align-self: stretch;
  box-sizing: border-box;
}

/* v-loading 遮罩（替代 element-ui Loading；1.x 的覆盖段取值：透明底 + 20% 模糊） */
.twikoo .tk-loading-parent--relative {
  position: relative;
}
.twikoo .tk-loading-mask {
  position: absolute;
  z-index: 2000;
  background-color: transparent;
  backdrop-filter: opacity(20%);
  margin: 0;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transition: opacity 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.twikoo .tk-loading-spinner .circular {
  height: 42px;
  width: 42px;
  animation: tk-loading-rotate 2s linear infinite;
}
.twikoo .tk-loading-spinner .path {
  animation: tk-loading-dash 1.5s ease-in-out infinite;
  stroke: #409eff;
  stroke-width: 2;
  stroke-linecap: round;
}
@keyframes tk-loading-rotate {
  100% {
    transform: rotate(360deg);
  }
}
@keyframes tk-loading-dash {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -40px;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -120px;
  }
}
</style>

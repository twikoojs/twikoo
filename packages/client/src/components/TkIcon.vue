<!--
  tk-icon（§5.3：图标必须用 fontawesome-free 类名，禁自写 SVG；min 版无字体依赖时降级为空）。
-->
<template>
  <i class="tk-icon" :class="iconClass"></i>
</template>

<script lang="ts">
export default {
  name: "TkIcon",
  props: {
    /** fontawesome-free 图标名（如 "fa-solid fa-paper-plane"） */
    name: { type: String, required: true },
  },
  computed: {
    /** 图标类（透传 fontawesome 类名） */
    iconClass(): string {
      return this.name;
    },
  },
};
</script>

<style>
.twikoo .tk-icon {
  display: inline-block;
  font-style: normal;
  line-height: 1;
}
</style>

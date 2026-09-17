<!--
  TkFooter 页脚（1.x TkFooter.vue 的 Vue3 组合式重写）。

  BC-9：版本号不再来自硬编码 `version.js`，改为 `@twikoojs/shared` 的构建期占位符替换值。
-->
<template>
  <div class="tk-footer">
    Powered by
    <a href="https://twikoo.js.org" target="_blank" rel="noopener noreferrer">Twikoo</a>
    v{{ version }}
  </div>
</template>

<script setup lang="ts">
import { VERSION } from "@twikoojs/shared";

/** 当前版本（构建期注入；仓库内为 `0.0.0`） */
const version = VERSION;
</script>

<style>
.twikoo .tk-footer {
  width: 100%;
  text-align: end;
  font-size: 0.75em;
  color: #999999;
  margin-top: 1em;
}
</style>

<script setup>
import DefaultTheme from 'vitepress/theme'
import Twikoo from './Twikoo.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-features-after>
      <div class="home-comment-container">
        <Twikoo></Twikoo>
      </div>
    </template>
    <template #doc-after>
      <Twikoo></Twikoo>
    </template>
  </Layout>
</template>

<style>
.home-comment-container {
  position: relative;
  margin-top: 64px;
  padding: 0 24px;
}

@media (min-width: 640px) {
  .home-comment-container {
    padding: 0 48px;
  }
}

@media (min-width: 960px) {
  .home-comment-container {
    padding: 0 64px;
  }
}

.home-comment-container .comment-container {
  margin: 0 auto;
  max-width: 1152px;
}

.twikoo .el-loading-spinner .circular {
  margin-left: auto;
  margin-right: auto;
}
</style>

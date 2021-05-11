<template>
  <ParentLayout>
    <template #page-bottom>
      <div class="page-edit">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css" integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X" crossorigin="anonymous">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js" integrity="sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4" crossorigin="anonymous"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js" integrity="sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa" crossorigin="anonymous"></script>
        <div id="twikoo"></div>
        <script src="https://cdn.jsdelivr.net/npm/twikoo@1.3.1/dist/twikoo.all.min.js" ref="twikooJs"></script>
      </div>
    </template>
  </ParentLayout>
</template>

<script>
import ParentLayout from '@parent-theme/layouts/Layout.vue'

const envId = 'imaegoo-16fe3d'

export default {
  name: 'Layout',
  components: {
    ParentLayout
  },
  mounted () {
    this.initTwikoo()
    this.initJs()
  },
  methods: {
    initTwikoo () {
      try {
        twikoo.init({ envId })
      } catch (e) {}
    },
    initJs () {
      const twikooJs = this.$refs.twikooJs
      if (twikooJs) {
        twikooJs.onload = this.initTwikoo
        this.$router.afterEach(this.onRoute)
      }
    },
    onRoute (to, from) {
      if (to.path !== from.path) this.initTwikoo()
    }
  }
}
</script>

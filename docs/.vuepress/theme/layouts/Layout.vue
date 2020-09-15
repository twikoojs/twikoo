<template>
  <ParentLayout>
    <template #page-bottom>
      <div class="page-edit">
        <div id="twikoo"></div>
        <script src="https://cdn.jsdelivr.net/npm/twikoo/dist/twikoo.all.min.js" ref="twikooJs"></script>
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

<template>
  <div id="twikoo" class="twikoo">
    <tk-comments @admin="showAdmin = true" />
    <tk-counter />
    <tk-footer />
    <tk-admin :show="showAdmin" @close="showAdmin = false" />
  </div>
</template>

<script>
import TkComments from './components/TkComments.vue'
import TkCounter from './components/TkCounter.vue'
import TkFooter from './components/TkFooter.vue'
import TkAdmin from './components/TkAdmin.vue'

export default {
  components: {
    TkComments,
    TkCounter,
    TkFooter,
    TkAdmin
  },
  data () {
    return {
      showAdmin: false
    }
  }
}
</script>

<style>
.twikoo {
  position: relative;
  overflow: hidden;
}
.twikoo svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}
</style>

<template>
  <div id="twikoo" class="twikoo">
    <tk-comments />
    <tk-counter />
    <tk-footer />
  </div>
</template>

<script>
import TkComments from './components/TkComments.vue'
import TkCounter from './components/TkCounter.vue'
import TkFooter from './components/TkFooter.vue'

export default {
  components: {
    TkComments,
    TkCounter,
    TkFooter
  }
}
</script>

<template>
  <div class="twikoo">
    <tk-twii :id="twii._id"
      v-for="twii in twiis"
      :key="twii._id"
      :avatar="options.avatar"
      :author="options.author"
      :content="twii.content"
      :updated="twii.updated" />
  </div>
</template>

<script>
import TkTwii from './components/TkTwii.vue'

export default {
  components: {
    TkTwii
  },
  props: {
    options: Object
  },
  data () {
    return {
      twiis: []
    }
  },
  methods: {
    async initTwii () {
      if (this.$tcb && this.$tcb.db) {
        const twiis = await this.$tcb.db
          .collection('twii')
          .limit(10)
          .get()
        this.twiis = twiis.data
      }
    }
  },
  mounted () {
    this.initTwii()
  }
}
</script>

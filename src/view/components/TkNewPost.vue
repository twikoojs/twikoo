<template>
  <tk-new class="tk-new-post"
      :is-sending="isSending"
      @send="onSend" />
</template>

<script>
import { Post } from '../../js/entites'
import TkNew from './TkNew.vue'

export default {
  components: {
    TkNew
  },
  data () {
    return {
      isSending: false
    }
  },
  methods: {
    async onSend (options) {
      this.isSending = true
      const result = await this.$tcb.db
        .collection('post')
        .add(new Post(options))
      this.isSending = false
      this.$emit('update')
    }
  }
}
</script>

<template>
  <tk-new class="tk-new-comment"
      :is-sending="isSending"
      @send="onSend" />
</template>

<script>
import { Comment } from '../../js/entites'
import TkNew from './TkNew.vue'

export default {
  components: {
    TkNew
  },
  props: {
    pid: String
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
        .collection('comment')
        .add(new Comment({
          pid: this.pid,
          ...options
        }))
      this.isSending = false
      this.$emit('update')
    }
  }
}
</script>

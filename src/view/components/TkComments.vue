<template>
  <div class="tk-comments">
    <tk-submit @load="initComments" />
    <div class="tk-comments-container" v-loading="loading">
      <div class="tk-comments-title">{{ comments.length }} 条评论</div>
      <tk-comment v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :replying="replyId === comment.id"
        @reply="onReply"
        @load="initComments" />
    </div>
  </div>
</template>

<script>
import TkSubmit from './TkSubmit.vue'
import TkComment from './TkComment.vue'

export default {
  components: {
    TkSubmit,
    TkComment
  },
  data () {
    return {
      loading: true,
      comments: [],
      replyId: ''
    }
  },
  methods: {
    async initComments () {
      this.loading = true
      const comments = await this.$tcb.app.callFunction({
        name: 'comment-get',
        data: { url: window.location.pathname }
      })
      if (comments && comments.result && comments.result.data) {
        this.comments = comments.result.data
      }
      this.loading = false
    },
    onReply (id) {
      this.replyId = id
    }
  },
  mounted () {
    this.initComments()
  }
}
</script>

<style scoped>
.tk-comments-title {
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 1rem;
}
.tk-comments-container {
  min-height: 10rem;
}
</style>

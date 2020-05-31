<template>
  <div class="tk-comment">
    <div class="tk-comment-item"
        v-for="comment in comments"
        :key="comment._id">
      <tk-avatar :nick="comment.nick" :mail="comment.mail" :site="comment.site" readonly />
      <div class="tk-main">
        <div class="tk-first-line">
          <div class="tk-meta">
            <strong>{{ comment.nick }}</strong>
            <span class="tk-tag" v-if="comment.master">博主</span>
            <small class="tk-time">{{ getDisplayUpdated(comment.updated) }}</small>
          </div>
        </div>
        <div class="tk-content" v-html="comment.content"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { timeago } from '../../js/utils'
import TkAvatar from './TkAvatar.vue'

export default {
  components: {
    TkAvatar
  },
  props: {
    pid: String
  },
  data () {
    return {
      comments: []
    }
  },
  methods: {
    async initComment () {
      const comments = await this.$tcb.db
        .collection('comment')
        .where({ pid: this.pid })
        .orderBy('updated', 'asc')
        .get()
      this.comments = comments.data
    },
    getDisplayUpdated (updated) {
      return timeago(updated)
    }
  },
  mounted () {
    this.initComment()
  }
}
</script>

<style scoped>
.tk-comment-item {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: row;
}
</style>

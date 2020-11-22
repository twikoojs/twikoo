<template>
  <div class="tk-comments">
    <tk-submit @load="initComments" />
    <div class="tk-comments-container" v-loading="loading">
      <div class="tk-comments-title">
        <span>{{ comments.length }} 条评论</span>
        <span class="tk-icon" v-html="iconSetting" @click="openAdmin"></span>
      </div>
      <div class="tk-comments-no" v-if="!loading && !comments.length">没有评论</div>
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
import { call } from '../../js/utils'
import TkSubmit from './TkSubmit.vue'
import TkComment from './TkComment.vue'
import iconSetting from '@fortawesome/fontawesome-free/svgs/solid/cog.svg'

export default {
  components: {
    TkSubmit,
    TkComment
  },
  data () {
    return {
      loading: true,
      comments: [],
      replyId: '',
      iconSetting
    }
  },
  methods: {
    async initComments () {
      this.loading = true
      const comments = await call(this.$tcb, 'COMMENT_GET', {
        url: window.location.pathname
      })
      if (comments && comments.result && comments.result.data) {
        this.comments = comments.result.data
      }
      this.loading = false
    },
    onReply (id) {
      this.replyId = id
    },
    openAdmin () {
      this.$emit('admin')
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
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.tk-comments-container {
  min-height: 10rem;
  display: flex;
  flex-direction: column;
}
.tk-comments-no {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tk-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: sub;
  height: 0.75em;
  width: 0.75em;
  line-height: 0;
  cursor: pointer;
}
.tk-icon /deep/ svg {
  width: 100%;
  height: 100%;
  fill: #409eff;
}
</style>

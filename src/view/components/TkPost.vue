<template>
  <div class="tk-post">
    <tk-avatar :nick="post.nick" :mail="post.mail" :site="post.site" readonly />
    <div class="tk-main">
      <div class="tk-first-line">
        <div class="tk-meta">
          <strong>{{ post.nick }}</strong>
          <span class="tk-tag" v-if="post.master">博主</span>
          <small class="tk-time">{{ displayUpdated }}</small>
        </div>
        <div class="tk-action">
          <a href="#">赞</a>
          <a @click="showComment = !showComment">评论</a>
        </div>
      </div>
      <div class="tk-content" v-html="post.content"></div>
      <div class="tk-comment">
        <tk-comment v-if="showComment"
            ref="tkComment"
            :pid="post._id" />
        <tk-new-comment v-if="showComment"
            :pid="post._id"
            @update="updateComment" />
      </div>
    </div>
  </div>
</template>

<script>
import { timeago } from '../../js/utils'
import TkAvatar from './TkAvatar.vue'
import TkComment from './TkComment.vue'
import TkNewComment from './TkNewComment.vue'

export default {
  components: {
    TkAvatar,
    TkComment,
    TkNewComment
  },
  props: {
    post: Object
  },
  data () {
    return {
      showComment: false
    }
  },
  methods: {
    updateComment () {
      this.$refs.tkComment.initComment()
    }
  },
  computed: {
    displayUpdated () {
      return timeago(this.post.updated)
    }
  }
}
</script>

<style scoped>
.tk-action {
  display: none;
}
.tk-post:hover .tk-action {
  display: inline-block;
}
.tk-comment {
  display: flex;
  flex-direction: column;
}
.tk-new-comment {
  margin-top: 0.5rem;
}
</style>

<!-- styles used by tk-post and tk-comment -->
<style>
.tk-post {
  display: flex;
  flex-direction: row;
}
.tk-post .tk-avatar,
.tk-comment .tk-avatar {
  margin-right: 1rem;
}
.tk-post .tk-main,
.tk-comment .tk-main {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.tk-post .tk-first-line,
.tk-comment .tk-first-line {
  display: flex;
  flex-direction: row;
}
.tk-post .tk-meta,
.tk-comment .tk-meta {
  flex: 1;
}
.tk-post .tk-tag,
.tk-comment .tk-tag {
  font-size: 0.75rem;
  color: #67c23a;
  border: 1px solid rgba(103,194,58,.2);
  background-color: rgba(103,194,58,.1);
  border-radius: 2px;
  padding: 1px 3px;
  margin-left: 0.5rem;
}
.tk-post .tk-time,
.tk-comment .tk-time {
  margin-left: 0.5rem;
}
</style>

<template>
  <div class="tk-comment" :id="comment.id">
    <tk-avatar :nick="comment.nick" :mail-md5="comment.mailMd5" :link="comment.link" />
    <div class="tk-main">
      <div class="tk-row">
        <div class="tk-meta">
          <strong class="tk-nick" v-if="!comment.link">{{ comment.nick }}</strong>
          <a class="tk-nick tk-nick-link" v-if="comment.link" :href="comment.link" target="_blank">
            <strong>{{ comment.nick }}</strong>
          </a>
          <span class="tk-tag tk-tag-green" v-if="comment.master">博主</span>
          <small class="tk-time">{{ displayUpdated }}</small>
          <div class="tk-tag">{{ comment.os }}</div>
          <div class="tk-tag">{{ comment.browser }}</div>
        </div>
        <tk-action :liked="comment.liked"
            :like-count="comment.like"
            :replies-count="comment.replies.length"
            @like="onLike"
            @reply="onReply" />
      </div>
      <div class="tk-content">
        <span v-if="comment.rid">回复 <a :href="`#${comment.rid}`">@{{ comment.ruser }}</a> :</span>
        <span v-html="comment.comment"></span>
      </div>
      <!-- 回复列表 -->
      <div class="tk-replies" :class="{ 'tk-replies-expand': isExpanded }" ref="tk-replies">
        <tk-comment v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            @load="onLoad"
            @reply="onReplyReply" />
        <div class="tk-expand" v-if="showExpand" @click="onExpand">查看更多...</div>
      </div>
      <!-- 回复框 -->
      <tk-submit v-if="replying"
          :reply-id="comment.id"
          :pid="pid"
          @load="onLoad"
          @cancel="onCancel" />
    </div>
  </div>
</template>

<script>
import { timeago } from '../../js/utils'
import TkAction from './TkAction.vue'
import TkAvatar from './TkAvatar.vue'
import TkSubmit from './TkSubmit.vue'

export default {
  name: 'tk-comment', // 允许组件模板递归地调用自身
  components: {
    TkAction,
    TkAvatar,
    TkSubmit
  },
  data () {
    return {
      pid: '',
      isExpanded: false,
      hasExpand: false
    }
  },
  props: {
    comment: Object,
    replying: Boolean
  },
  computed: {
    displayUpdated () {
      return timeago(this.comment.updated)
    },
    showExpand () {
      return this.hasExpand && !this.isExpanded
    }
  },
  methods: {
    showExpandIfNeed () {
      if (this.comment.replies && this.comment.replies.length > 0 && this.$refs['tk-replies']) {
        this.hasExpand = this.$refs['tk-replies'].scrollHeight > 200
      }
    },
    onLike () {
      const updated = this.$tcb.app.callFunction({
        name: 'comment-like',
        data: { id: this.comment.id }
      })
      if (this.comment.liked) {
        this.comment.like--
      } else {
        this.comment.like++
      }
      this.comment.liked = !this.comment.liked
    },
    onReply () {
      this.$emit('reply', this.comment.id)
    },
    onReplyReply (id) {
      // 楼中楼回复
      this.pid = id
      this.$emit('reply', this.comment.id)
    },
    onCancel () {
      this.pid = ''
      this.$emit('reply', '')
    },
    onLoad () {
      this.pid = ''
      this.$emit('reply', '')
      this.$emit('load')
      this.onExpand()
    },
    onExpand () {
      this.isExpanded = true
    }
  },
  mounted () {
    this.$nextTick(this.showExpandIfNeed)
  }
}
</script>

<style scoped>
.tk-main {
  flex: 1;
  width: 0;
}
.tk-row {
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.tk-avatar {
  margin-right: 1rem;
}
.tk-nick-link {
  color: inherit;
  text-decoration: none;
}
.tk-nick-link:hover {
  color: #409eff;
}
.tk-tag {
  display: inline-block;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  background-color: #f2f6fc;
}
.tk-tag-green {
  background-color: #f0f9eb;
  border: 1px solid #e1f3d8;
  color: #67c23a;
}
.tk-comment {
  margin-top: 1rem;
  display: flex;
  flex-direction: row;
  word-break: break-all;
}
.tk-content {
  margin-top: 0.5rem;
}
.tk-comment /deep/ .vemoji {
  max-height: 2em;
  vertical-align: middle;
}
.tk-replies {
  max-height: 200px;
  overflow: hidden;
  position: relative;
}
.tk-replies-expand {
  max-height: none;
}
.tk-expand {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1));
  cursor: pointer;
}
.tk-submit {
  margin-top: 1rem;
}
</style>

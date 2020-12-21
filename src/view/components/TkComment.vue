<template>
  <div class="tk-comment" :id="comment.id" ref="tk-comment">
    <tk-avatar :config="config"
        :nick="comment.nick"
        :avatar="comment.avatar"
        :mail-md5="comment.mailMd5"
        :link="convertedLink" />
    <div class="tk-main">
      <div class="tk-row">
        <div class="tk-meta">
          <strong class="tk-nick" v-if="!convertedLink">{{ comment.nick }}</strong>
          <a class="tk-nick tk-nick-link" v-if="convertedLink" :href="convertedLink" target="_blank">
            <strong>{{ comment.nick }}</strong>
          </a>
          <span class="tk-tag tk-tag-green" v-if="comment.master">{{ config.MASTER_TAG || '博主' }}</span>
          <small class="tk-time">{{ displayCreated }}</small>
        </div>
        <tk-action :liked="liked"
            :like-count="like"
            :replies-count="comment.replies.length"
            @like="onLike"
            @reply="onReply" />
      </div>
      <div class="tk-content">
        <span v-if="comment.pid">回复 <a :href="`#${comment.pid}`">@{{ comment.ruser }}</a> :</span>
        <span v-html="comment.comment"></span>
      </div>
      <div class="tk-extras" v-if="comment.os || comment.browser">
        <div class="tk-extra"><span class="tk-icon" v-html="iconOs"></span>&nbsp;{{ comment.os }}</div>
        <div class="tk-extra"><span class="tk-icon" v-html="iconBrowser"></span>&nbsp;{{ comment.browser }}</div>
      </div>
      <!-- 回复列表 -->
      <div class="tk-replies" :class="{ 'tk-replies-expand': isExpanded || !showExpand }" ref="tk-replies">
        <tk-comment v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            :config="config"
            @load="onLoad"
            @reply="onReplyReply" />
      </div>
      <!-- 回复框 -->
      <tk-submit v-if="replying"
          :reply-id="comment.id"
          :pid="pid"
          :config="config"
          @load="onLoad"
          @cancel="onCancel" />
      <div class="tk-expand" v-if="showExpand" @click="onExpand">展开</div>
    </div>
  </div>
</template>

<script>
import { timeago, convertLink, call } from '../../js/utils'
import TkAction from './TkAction.vue'
import TkAvatar from './TkAvatar.vue'
import TkSubmit from './TkSubmit.vue'
import iconWindows from '@fortawesome/fontawesome-free/svgs/brands/windows.svg'
import iconApple from '@fortawesome/fontawesome-free/svgs/brands/apple.svg'
import iconAndroid from '@fortawesome/fontawesome-free/svgs/brands/android.svg'
import iconLinux from '@fortawesome/fontawesome-free/svgs/brands/linux.svg'
import iconUbuntu from '@fortawesome/fontawesome-free/svgs/brands/ubuntu.svg'
import iconChrome from '@fortawesome/fontawesome-free/svgs/brands/chrome.svg'
import iconFirefox from '@fortawesome/fontawesome-free/svgs/brands/firefox-browser.svg'
import iconSafari from '@fortawesome/fontawesome-free/svgs/brands/safari.svg'
import iconIe from '@fortawesome/fontawesome-free/svgs/brands/internet-explorer.svg'
import iconEdge from '@fortawesome/fontawesome-free/svgs/brands/edge.svg'
import iconOther from '@fortawesome/fontawesome-free/svgs/regular/window-maximize.svg'

const osList = {
  win: iconWindows,
  mac: iconApple,
  ipad: iconApple,
  iphone: iconApple,
  ios: iconApple,
  android: iconAndroid,
  ubuntu: iconUbuntu,
  linux: iconLinux
}

const browserList = {
  edge: iconEdge,
  chrome: iconChrome,
  firefox: iconFirefox,
  safari: iconSafari,
  explorer: iconIe,
  ie: iconIe
}

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
      like: 0,
      liked: false,
      likeLoading: false,
      isExpanded: false,
      hasExpand: false
    }
  },
  props: {
    comment: Object,
    replying: Boolean,
    config: Object
  },
  computed: {
    displayCreated () {
      return timeago(this.comment.created)
    },
    iconOs () {
      return this.getIconBy(this.comment.os, osList)
    },
    iconBrowser () {
      return this.getIconBy(this.comment.browser, browserList)
    },
    showExpand () {
      return this.hasExpand && !this.isExpanded
    },
    convertedLink () {
      return convertLink(this.comment.link)
    }
  },
  methods: {
    getIconBy (name, list) {
      const lowerCaseName = name.toLowerCase()
      for (const key in list) {
        if (lowerCaseName.indexOf(key) !== -1) return list[key]
      }
      return iconOther
    },
    showExpandIfNeed () {
      if (this.comment.replies && this.comment.replies.length > 0 && this.$refs['tk-replies']) {
        this.hasExpand = this.$refs['tk-replies'].scrollHeight > 200
      }
    },
    scrollToComment () {
      if (window.location.hash.indexOf(this.comment.id) !== -1) {
        this.$refs['tk-comment'].scrollIntoView()
      }
    },
    async onLike () {
      if (this.likeLoading) return // 防止连续点击
      this.likeLoading = true
      await call(this.$tcb, 'COMMENT_LIKE', { id: this.comment.id })
      if (this.liked) {
        this.like--
      } else {
        this.like++
      }
      this.liked = !this.liked
      this.likeLoading = false
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
    this.$nextTick(this.scrollToComment)
  },
  watch: {
    'comment.like': {
      handler: function (like) {
        this.like = this.comment.like
        this.liked = this.comment.liked
      },
      immediate: true
    }
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
.tk-extras {
  color: #999999;
  font-size: 0.875em;
  display: flex;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}
.tk-extra {
  margin-right: 0.75rem;
}
.tk-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: sub;
  height: 1em;
  width: 1em;
  line-height: 0;
}
.tk-icon /deep/ svg {
  width: 100%;
  fill: currentColor;
}
.tk-tag {
  display: inline-block;
  padding: 0 0.5em;
  font-size: 0.75em;
  background-color: #f2f6fc;
}
.tk-tag-green {
  background-color: #67c23a20;
  border: 1px solid #67c23a80;
  border-radius: 2px;
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
.tk-submit {
  margin-top: 1rem;
}
.tk-expand {
  font-size: 0.75em;
}
</style>

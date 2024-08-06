<template>
  <div class="tk-comment" :id="comment.id" :class="{ 'tk-master': comment.master }" ref="tk-comment">
    <tk-avatar :config="config"
        :nick="comment.nick"
        :avatar="comment.avatar"
        :mail-md5="comment.mailMd5"
        :link="convertedLink" />
    <div class="tk-main">
      <div class="tk-row">
        <div class="tk-meta">
          <strong class="tk-nick" v-if="!convertedLink">{{ comment.nick }}</strong>
          <a class="tk-nick tk-nick-link" v-if="convertedLink" :href="convertedLink" target="_blank" rel="noopener noreferrer">
            <strong>{{ comment.nick }}</strong>
          </a>
          <span class="tk-tag tk-tag-green" v-if="comment.master">{{ config.MASTER_TAG || t('COMMENT_MASTER_TAG') }}</span>
          <span class="tk-tag tk-tag-red" v-if="comment.top">{{ t('COMMENT_TOP_TAG') }}</span>
          <span class="tk-tag tk-tag-yellow" v-if="comment.isSpam">{{ t('COMMENT_REVIEWING_TAG') }}</span>
          <small class="tk-time">
            <time :datetime="jsonTimestamp" :title="localeTime">{{ displayCreated }}</time>
          </small>
          <small class="tk-actions" v-if="isLogin">
            <a href="#" v-if="comment.isSpam" @click="handleSpam(false, $event)">{{ t('ADMIN_COMMENT_SHOW') }}</a>
            <a href="#" v-if="!comment.isSpam" @click="handleSpam(true, $event)">{{ t('ADMIN_COMMENT_HIDE') }}</a>
            <a href="#" v-if="!comment.rid && comment.top" @click="handleTop(false, $event)">{{ t('ADMIN_COMMENT_UNTOP') }}</a>
            <a href="#" v-if="!comment.rid && !comment.top" @click="handleTop(true, $event)">{{ t('ADMIN_COMMENT_TOP') }}</a>
          </small>
        </div>
        <tk-action :liked="liked"
            :like-count="like"
            :replies-count="comment.replies.length"
            @like="onLike"
            @reply="onReply" />
      </div>
      <div class="tk-content" :class="{ 'tk-content-expand': isContentExpanded || !showContentExpand }" ref="tk-content">
        <span v-if="comment.pid">{{ t('COMMENT_REPLIED') }} <a class="tk-ruser" :href="`#${comment.pid}`">@{{ comment.ruser }}</a> :</span>
        <span v-html="comment.comment" ref="comment" @click="popupLightbox"></span>
      </div>
      <div class="tk-expand-wrap" v-if="showContentExpand">
        <div class="tk-expand" @click="onContentExpand">{{ t('COMMENT_EXPAND') }}</div>
      </div>
      <div class="tk-collapse-wrap" v-if="showContentCollapse">
        <div class="tk-expand _collapse" @click="onContentCollapse">{{ t('COMMENT_COLLAPSE') }}</div>
      </div>
      <div class="tk-extras" v-if="comment.ipRegion || comment.os || comment.browser">
        <div class="tk-extra" v-if="comment.ipRegion">
          <span class="tk-icon __comment" v-html="iconLocation"></span>
          <span class="tk-extra-text">&nbsp;{{ comment.ipRegion }}</span>
        </div>
        <div class="tk-extra" v-if="comment.os">
          <span class="tk-icon __comment" v-html="iconOs"></span>
          <span class="tk-extra-text">&nbsp;{{ comment.os }}</span>
        </div>
        <div class="tk-extra" v-if="comment.browser">
          <span class="tk-icon __comment" v-html="iconBrowser"></span>
          <span class="tk-extra-text">&nbsp;{{ comment.browser }}</span>
        </div>
      </div>
      <!-- 回复框 -->
      <tk-submit v-if="replying && !pid"
          :reply-id="replyId ? replyId : comment.id"
          :pid="comment.id"
          :config="config"
          @load="onLoad"
          @cancel="onCancel" />
      <!-- 回复列表 -->
      <div class="tk-replies" :class="{ 'tk-replies-expand': isExpanded || !showExpand || replying }" ref="tk-replies">
        <tk-comment v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            :replyId="comment.id"
            :replying="replying && pid === reply.id"
            :config="config"
            @expand="onExpand"
            @load="onLoad"
            @reply="onReplyReply" />
      </div>
      <div class="tk-expand-wrap" v-if="showExpand && !replying">
        <div class="tk-expand" @click="onExpand">{{ t('COMMENT_EXPAND') }}</div>
      </div>
      <div class="tk-collapse-wrap" v-if="showCollapse && !replying">
        <div class="tk-expand _collapse" @click="onCollapse">{{ t('COMMENT_COLLAPSE') }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { timeago, convertLink, call, renderLinks, renderMath, renderCode, t } from '../../utils'
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
import iconLocation from '@fortawesome/fontawesome-free/svgs/solid/location-arrow.svg'

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
      hasExpand: false,
      isContentExpanded: false,
      hasContentExpand: false,
      isLogin: false
    }
  },
  props: {
    comment: Object,
    replyId: String,
    replying: Boolean,
    config: Object
  },
  computed: {
    displayCreated () {
      return timeago(this.comment.created)
    },
    jsonTimestamp () {
      return new Date(this.comment.created).toJSON()
    },
    localeTime () {
      return new Date(this.comment.created).toLocaleString()
    },
    iconOs () {
      return this.getIconBy(this.comment.os, osList)
    },
    iconBrowser () {
      return this.getIconBy(this.comment.browser, browserList)
    },
    iconLocation: () => iconLocation,
    showExpand () {
      return this.hasExpand && !this.isExpanded
    },
    showCollapse () {
      return this.hasExpand && this.isExpanded
    },
    showContentExpand () {
      return this.hasContentExpand && !this.isContentExpanded
    },
    showContentCollapse () {
      return this.hasContentExpand && this.isContentExpanded
    },
    convertedLink () {
      return convertLink(this.comment.link)
    }
  },
  methods: {
    t,
    getIconBy (name, list) {
      const lowerCaseName = name.toLowerCase()
      for (const key in list) {
        if (lowerCaseName.indexOf(key) !== -1) return list[key]
      }
      return iconOther
    },
    showExpandIfNeed () {
      if (this.comment.replies && this.comment.replies.length > 0 && this.$refs['tk-replies']) {
        // 200 是回复区域最大高度
        // 36 是展开按钮高度
        this.hasExpand = this.$refs['tk-replies'].scrollHeight > 200 + 36
      }
    },
    showContentExpandIfNeed () {
      // 如果已经折叠就不再判断 主要是为了防止图片在onload之前就已经折叠而导致图片在onload之后取消折叠
      this.hasContentExpand = this.hasContentExpand || this.$refs['tk-content'].scrollHeight > 500
    },
    showContentExpandIfNeedAfterImagesLoaded () {
      this.$refs['tk-content'].querySelectorAll('img').forEach((imgEl) => {
        imgEl.onload = this.showContentExpandIfNeed
      })
    },
    scrollToComment () {
      if (window.location.hash.indexOf(this.comment.id) !== -1) {
        this.$refs['tk-comment'].scrollIntoView({
          behavior: 'smooth'
        })
        this.$emit('expand')
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
    onReply (id) {
      this.pid = id
      this.$emit('reply', this.comment.id)
    },
    onReplyReply (id) {
      // 楼中楼回复
      this.pid = id
      if (id) {
        // action 回复按钮 触发
        this.$emit('reply', this.comment.id)
      } else {
        // submit 取消按钮 触发
        this.$emit('reply', '')
      }
    },
    onCancel () {
      this.pid = ''
      this.$emit('reply', '')
    },
    onLoad () {
      if (this.comment.replies.length > 0) {
        this.$refs['tk-replies'].lastElementChild.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
      this.pid = ''
      this.$emit('reply', '')
      this.$emit('load')
      this.onExpand()
    },
    onExpand () {
      this.isExpanded = true
    },
    onCollapse () {
      this.isExpanded = false
    },
    onContentExpand () {
      this.isContentExpanded = true
    },
    onContentCollapse () {
      this.isContentExpanded = false
    },
    async checkAuth () {
      // 检查用户身份
      if (this.$tcb) {
        const currentUser = await this.$tcb.auth.getCurrenUser()
        this.isLogin = currentUser.loginType === 'CUSTOM'
      } else {
        this.isLogin = this.$twikoo.serverConfig && this.$twikoo.serverConfig.IS_ADMIN
      }
    },
    handleSpam (isSpam, $event) {
      $event.preventDefault()
      this.setComment({ isSpam })
    },
    handleTop (top, $event) {
      $event.preventDefault()
      this.setComment({ top })
    },
    popupLightbox (event) {
      if (this.$twikoo.serverConfig.LIGHTBOX !== 'true') return
      const { target } = event
      if (target.tagName === 'IMG' && !target.classList.contains('tk-owo-emotion')) {
        const lightbox = document.createElement('div')
        lightbox.className = 'tk-lightbox'
        const lightboxImg = document.createElement('img')
        lightboxImg.className = 'tk-lightbox-image'
        lightboxImg.src = target.src
        lightbox.appendChild(lightboxImg)
        lightbox.addEventListener('click', () => {
          document.body.removeChild(lightbox)
        })
        document.body.appendChild(lightbox)
      }
    },
    async setComment (set) {
      this.loading = true
      await call(this.$tcb, 'COMMENT_SET_FOR_ADMIN', {
        id: this.comment.id,
        set
      })
      this.loading = false
      this.$emit('load')
    }
  },
  mounted () {
    this.$nextTick(this.showContentExpandIfNeed)
    this.$nextTick(this.showContentExpandIfNeedAfterImagesLoaded)
    this.$nextTick(this.showExpandIfNeed)
    this.$nextTick(this.scrollToComment)
    this.$nextTick(() => {
      renderLinks(this.$refs.comment)
      renderMath(this.$refs.comment, this.$twikoo.katex)
    })
    this.checkAuth()
  },
  watch: {
    'comment.like': {
      handler: function (like) {
        this.like = this.comment.like
        this.liked = this.comment.liked
      },
      immediate: true
    },
    'config.HIGHLIGHT': {
      handler: function (highlight) {
        if (highlight === 'true') {
          this.$nextTick(() => {
            renderCode(this.$refs.comment, this.config.HIGHLIGHT_THEME, this.config.HIGHLIGHT_PLUGIN)
          })
        }
      },
      immediate: true
    }
  }
}
</script>

<style>
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
.tk-nick-link {
  color: inherit;
  text-decoration: none;
}
.tk-replies .tk-nick-link {
  font-size: .9em;
}
.tk-nick-link:hover {
  color: #409eff;
}
.tk-actions {
  display: none;
  margin-left: 1em;
}
.tk-comment:hover .tk-actions {
  display: inline;
}
.tk-extras {
  color: #999999;
  font-size: 0.875em;
  display: flex;
  flex-wrap: wrap;
}
.tk-extra {
  margin-top: 0.5rem;
  margin-right: 0.75rem;
  display: flex;
  align-items: center;
}
.tk-icon.__comment {
  height: 1em;
  width: 1em;
  line-height: 1;
}
.tk-extra-text {
  line-height: 1;
}
.tk-tag {
  display: inline-block;
  padding: 0 0.5em;
  font-size: 0.75em;
  background-color: #f2f6fc;
}
.tk-tag-green {
  background-color: rgba(103,194,58,0.13);
  border: 1px solid rgba(103,194,58,0.50);
  border-radius: 2px;
  color: #67c23a;
}
.tk-tag-yellow {
  background-color: rgba(230,162,60,0.13);
  border: 1px solid rgba(230,162,60,0.50);
  border-radius: 2px;
  color: #e6a23c;
}
.tk-tag-blue {
  background-color: rgba(64,158,255,0.13);
  border: 1px solid rgba(64,158,255,0.50);
  border-radius: 2px;
  color: #409eff;
}
.tk-tag-red {
  background-color: rgba(245,108,108,0.13);
  border: 1px solid rgba(245,108,108,0.50);
  border-radius: 2px;
  color: #f56c6c;
}
.tk-comment {
  margin-top: 1rem;
  display: flex;
  flex-direction: row;
  word-break: break-all;
}
.tk-content {
  margin-top: 0.5rem;
  overflow: hidden;
  max-height: 500px;
  position: relative;
}
.tk-content-expand {
  max-height: none;
}
.tk-replies .tk-content {
  font-size: .9em;
}
.tk-comment .vemoji {
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
  overflow: unset;
}
.tk-submit {
  margin-top: 1rem;
}
.tk-expand {
  font-size: 0.75em;
}
.tk-lightbox {
  display: block;
  position: fixed;
  background-color: rgba(0, 0, 0, 0.3);
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
.tk-lightbox-image {
  min-width: 100px;
  min-height: 30px;
  width: auto;
  height: auto;
  max-width: 95%;
  max-height: 95%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(90deg, #eeeeee 50%, #e3e3e3 0);
  background-size: 40px 100%;
}
</style>

<template>
  <div class="tk-admin-comment" v-loading="loading">
    <div class="tk-admin-warn" v-if="clientVersion !== serverVersion">
      <span>{{ t('ADMIN_CLIENT_VERSION') }}{{ clientVersion }}，</span>
      <span>{{ t('ADMIN_SERVER_VERSION') }}{{ serverVersion }}，</span>
      <span>请参考&nbsp;<a href="https://twikoo.js.org/update.html" target="_blank">版本更新</a>&nbsp;进行升级</span>
    </div>
    <div class="tk-admin-comment-filter">
      <el-input
          class="tk-admin-comment-filter-keyword"
          size="small"
          v-model="filter.keyword"
          :placeholder="t('ADMIN_COMMENT_SEARCH_PLACEHOLDER')"
          @keyup.enter.native="getComments" />
      <select class="tk-admin-comment-filter-type" v-model="filter.type">
        <option value="">{{ t('ADMIN_COMMENT_FILTER_ALL') }}</option>
        <option value="VISIBLE">{{ t('ADMIN_COMMENT_FILTER_VISIBLE') }}</option>
        <option value="HIDDEN">{{ t('ADMIN_COMMENT_FILTER_HIDDEN') }}</option>
      </select>
      <el-button size="small" type="primary" @click="getComments">{{ t('ADMIN_COMMENT_SEARCH') }}</el-button>
    </div>
    <div class="tk-admin-comment-list" ref="comment-list">
      <div class="tk-admin-comment-item" v-for="comment in comments" :key="comment._id">
        <div class="tk-admin-comment-meta">
          <tk-avatar :config="serverConfig" :avatar="comment.avatar" :nick="comment.nick" :mail="comment.mail" :link="comment.link" />
          <span v-if="!comment.link">{{ comment.nick }}&nbsp;</span>
          <a v-if="comment.link" :href="convertLink(comment.link)" target="_blank">{{ comment.nick }}&nbsp;</a>
          <span v-if="comment.mail">(<a :href="`mailto:${comment.mail}`">{{ comment.mail }}</a>)&nbsp;</span>
          <span v-if="comment.isSpam">{{ t('ADMIN_COMMENT_IS_SPAM_SUFFIX') }}&nbsp;</span>
          <span class="tk-time">{{ displayCreated(comment) }}&nbsp;</span>
          <span :title="comment.ua">{{ comment.ipRegion }}</span>
        </div>
        <div class="tk-content" v-html="comment.comment" ref="comments"></div>
        <div class="tk-admin-warn tk-admin-security-alert" v-if="securityAlert && securityAlert.commentId === comment._id">
          <a class="tk-admin-close" href="#" @click.prevent="securityAlert = null" v-html="iconClose"></a>
          <div class="tk-admin-security-alert-message">{{ securityAlert.message }}</div>
          <div class="tk-admin-security-alert-url" v-if="securityAlert.url">
            <code>{{ securityAlert.url }}</code>
          </div>
        </div>
        <div class="tk-admin-actions">
          <el-button size="mini" type="text" @click="handleView(comment)">{{ t('ADMIN_COMMENT_VIEW') }}</el-button>
          <el-button size="mini" type="text" v-if="comment.isSpam" @click="handleSpam(comment, false)">{{ t('ADMIN_COMMENT_SHOW') }}</el-button>
          <el-button size="mini" type="text" v-if="!comment.isSpam" @click="handleSpam(comment, true)">{{ t('ADMIN_COMMENT_HIDE') }}</el-button>
          <el-button size="mini" type="text" v-if="!comment.rid && comment.top" @click="handleTop(comment, false)">{{ t('ADMIN_COMMENT_UNTOP') }}</el-button>
          <el-button size="mini" type="text" v-if="!comment.rid && !comment.top" @click="handleTop(comment, true)">{{ t('ADMIN_COMMENT_TOP') }}</el-button>
          <el-button size="mini" type="text" @click="handleDelete(comment)">{{ t('ADMIN_COMMENT_DELETE') }}</el-button>
        </div>
      </div>
    </div>
    <tk-pagination
        :page-size="pageSize"
        :total="count"
        @page-size-change="onPageSizeChange"
        @current-change="switchPage" />
  </div>
</template>

<script>
import { app } from '../index'
import { timeago, call, convertLink, renderLinks, renderMath, renderCode, t } from '../../utils'
import { version } from '../../version'
import TkAvatar from './TkAvatar.vue'
import TkPagination from './TkPagination.vue'
import iconClose from '@fortawesome/fontawesome-free/svgs/solid/times.svg'

const defaultPageSize = 5

export default {
  components: {
    TkAvatar,
    TkPagination
  },
  data () {
    return {
      loading: true,
      comments: [],
      serverConfig: {},
      serverVersion: this.$twikoo.serverConfig.VERSION,
      clientVersion: version,
      count: 0,
      pageSize: defaultPageSize,
      currentPage: 1,
      filter: { keyword: '', type: '' },
      securityAlert: null,
      iconClose
    }
  },
  methods: {
    t,
    displayCreated (comment) {
      return timeago(comment.created)
    },
    convertLink (link) {
      return convertLink(link)
    },
    async getComments () {
      this.loading = true
      const res = await call(this.$tcb, 'COMMENT_GET_FOR_ADMIN', {
        per: this.pageSize,
        page: this.currentPage,
        keyword: this.filter.keyword,
        type: this.filter.type
      })
      if (res.result && !res.result.code) {
        this.count = res.result.count
        this.comments = res.result.data
      }
      this.$nextTick(() => {
        renderLinks(this.$refs.comments)
        renderMath(this.$refs['comment-list'], this.$twikoo.katex)
        this.highlightCode()
      })
      this.loading = false
    },
    async getConfig () {
      const res = await call(this.$tcb, 'GET_CONFIG_FOR_ADMIN')
      if (res.result && !res.result.code) {
        this.serverConfig = res.result.config
        this.checkConfig()
      }
    },
    checkConfig () {
      if (!this.serverConfig.HIGHLIGHT) this.serverConfig.HIGHLIGHT = 'true'
      // 在已登錄的情況下，不用再輸入昵稱和郵箱等信息
      let metaData = {}
      const mStr = localStorage.getItem('twikoo')
      if (mStr) {
        metaData = JSON.parse(mStr)
      }
      ['nick', 'mail', 'avatar'].forEach(key => {
        if (!metaData[key]) {
          this.serverConfig[key] = ''
        } else {
          this.serverConfig[key] = metaData[key]
        }
      })
      if (!metaData.nick && this.serverConfig.BLOGGER_NICK) {
        metaData.nick = this.serverConfig.BLOGGER_NICK
      }
      if (!metaData.mail && this.serverConfig.BLOGGER_EMAIL) {
        metaData.mail = this.serverConfig.BLOGGER_EMAIL
      }
      if (!metaData.link && this.serverConfig.SITE_URL) {
        metaData.link = this.serverConfig.SITE_URL
      }
      localStorage.setItem('twikoo', JSON.stringify(metaData))
      app.$emit('initMeta')
    },
    onPageSizeChange (newPageSize) {
      this.pageSize = newPageSize
      this.getComments()
    },
    switchPage (e) {
      this.currentPage = e
      this.getComments()
    },
    handleView(comment) {
      const targetUrl = `${comment.url}#${comment._id}`
      try {
        const url = new URL(targetUrl)
        if (url.hostname !== window.location.hostname) {
          // 域名不同，显示提示，要求用户手动复制访问
          this.securityAlert = {
            commentId: comment._id,
            message: t('ADMIN_COMMENT_SECURITY_ALERT'),
            url: targetUrl
          }
          return
        }
        // 域名相同，允许打开
        window.open(targetUrl)
      } catch (e) {
        try {
          // 尝试将其作为相对路径解析，如果成功说明是有效的相对路径
          new URL(targetUrl, window.location.origin)
          // 允许打开
          window.open(targetUrl)
        } catch (e2) {
          // 作为相对路径也无法解析，说明 URL 格式错误
          this.securityAlert = {
            commentId: comment._id,
            message: t('ADMIN_COMMENT_PARSE_ERROR'),
            url: comment.url
          }
        }
      }
    },
    async handleDelete (comment) {
      if (!confirm(t('ADMIN_COMMENT_DELETE_CONFIRM'))) return
      this.loading = true
      await call(this.$tcb, 'COMMENT_DELETE_FOR_ADMIN', {
        id: comment._id
      })
      await this.getComments()
      this.loading = false
    },
    handleSpam (comment, isSpam) {
      this.setComment(comment, { isSpam })
    },
    handleTop (comment, top) {
      this.setComment(comment, { top })
    },
    async setComment (comment, set) {
      this.loading = true
      await call(this.$tcb, 'COMMENT_SET_FOR_ADMIN', {
        id: comment._id,
        set
      })
      await this.getComments()
      this.loading = false
    },
    highlightCode () {
      if (this.serverConfig.HIGHLIGHT === 'true') {
        renderCode(this.$refs['comment-list'], this.serverConfig.HIGHLIGHT_THEME, this.serverConfig.HIGHLIGHT_PLUGIN)
      }
    }
  },
  async mounted () {
    await Promise.all([
      this.getConfig(),
      this.getComments()
    ])
    this.highlightCode()
  }
}
</script>

<style>
.tk-admin-comment {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tk-admin-comment a {
  color: currentColor;
  text-decoration: underline;
}
.tk-admin-warn {
  margin-bottom: 1em;
}
.tk-admin-security-alert {
  position: relative;
  padding-right: 2.5rem;
  margin-bottom: 0;
}
.tk-admin-security-alert .tk-admin-close {
  position: absolute;
  top: 0;
  right: 0;
  float: none;
  width: 1rem;
  height: 1rem;
  padding: 0.5rem;
  margin: 0;
}
.tk-admin-security-alert-message {
  margin-bottom: 0.5em;
}
.tk-admin-security-alert-url {
  word-break: break-all;
  background: rgba(0,0,0,0.2);
  padding: 0.5em;
  border-radius: 4px;
  margin-bottom: 0.5em;
}
.tk-admin-comment-filter {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
.tk-admin-comment-filter-keyword {
  flex: 1;
}
.tk-admin-comment-filter-type {
  height: 32px;
  margin: 0 0.5em;
  padding: 0 0.5em;
  color: #ffffff;
  background: none;
  border: 1px solid rgba(144,147,153,0.31);
  border-radius: 4px;
  position: relative;
  -moz-appearance: none;
  -webkit-appearance: none;
}
.tk-admin-comment-filter-type:focus {
  border-color: #409eff;
}
.tk-admin-comment-filter-type option {
  color: initial;
}
.tk-admin-comment-list {
  margin-top: 1em;
}
.tk-admin-comment-list,
.tk-admin-comment-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
}
.tk-admin-comment-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 0.5em;
}
.tk-admin-comment .tk-avatar {
  margin-right: 0.5em;
}
.tk-admin-comment .tk-content {
  max-height: none;
}
.tk-admin-actions {
  display: flex;
  margin-bottom: 1em;
  border-bottom: 1px solid rgba(255,255,255,0.5);
}
</style>

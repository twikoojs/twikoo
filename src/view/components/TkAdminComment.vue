<template>
  <div class="tk-admin-comment" v-loading="loading">
    <div class="tk-admin-warn" v-if="clientVersion !== serverVersion">
      <span>前端版本：{{ clientVersion }}，</span>
      <span>云函数版本：{{ serverVersion }}，</span>
      <span>请参考&nbsp;<a href="https://twikoo.js.org/quick-start.html#%E7%89%88%E6%9C%AC%E6%9B%B4%E6%96%B0" target="_blank">版本更新</a>&nbsp;进行升级</span>
    </div>
    <div class="tk-admin-comment-filter">
      <el-input
          class="tk-admin-comment-filter-keyword"
          size="small"
          v-model="filter.keyword"
          placeholder="搜索昵称、邮箱、网址、IP、评论正文、文章地址" />
      <select class="tk-admin-comment-filter-type" v-model="filter.type">
        <option value="">全部</option>
        <option value="VISIBLE">只看可见</option>
        <option value="HIDDEN">只看隐藏</option>
      </select>
      <el-button size="small" type="primary" @click="getComments">搜索</el-button>
    </div>
    <div class="tk-admin-comment-list" ref="comment-list">
      <div class="tk-admin-comment-item" v-for="comment in comments" :key="comment._id">
        <div class="tk-admin-comment-meta">
          <tk-avatar :config="serverConfig" :avatar="comment.avatar" :mail="comment.mail" :link="comment.link" />
          <span v-if="!comment.link">{{ comment.nick }}</span>
          <a v-if="comment.link" :href="convertLink(comment.link)" target="_blank">{{ comment.nick }}</a>
          <span v-if="comment.mail">&nbsp;(<a :href="`mailto:${comment.mail}`">{{ comment.mail }}</a>)</span>
          <span v-if="comment.isSpam">{{ t('ADMIN_COMMENT_IS_SPAM_SUFFIX') }}</span>
        </div>
        <div class="tk-content" v-html="comment.comment" ref="comments"></div>
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
import { call, convertLink, renderLinks, renderMath, renderCode, t } from '../../js/utils'
import { version } from '../../../package.json'
import TkAvatar from './TkAvatar.vue'
import TkPagination from './TkPagination.vue'

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
      filter: { keyword: '', type: '' }
    }
  },
  methods: {
    t,
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
        if (!this.serverConfig.HIGHLIGHT) this.serverConfig.HIGHLIGHT = 'true'
      }
    },
    onPageSizeChange (newPageSize) {
      this.pageSize = newPageSize
      this.getComments()
    },
    switchPage (e) {
      this.currentPage = e
      this.getComments()
    },
    handleView (comment) {
      window.open(`${comment.url}#${comment._id}`)
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
        renderCode(this.$refs['comment-list'], this.serverConfig.HIGHLIGHT_THEME)
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

<style scoped>
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
  border: 1px solid #90939950;
  border-radius: 4px;
  position: relative;
  -moz-appearance: none;
  -webkit-appearance: none;
}
.tk-admin-comment-filter-type:focus {
  border-color: #409eff;
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
  margin-bottom: 0.5em;
}
.tk-avatar {
  margin-right: 0.5em;
}
.tk-admin-actions {
  display: flex;
  margin-bottom: 1em;
}
</style>

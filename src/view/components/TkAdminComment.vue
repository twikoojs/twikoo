<template>
  <div class="tk-admin-comment" v-loading="loading">
    <div class="tk-admin-comment-list">
      <div class="tk-admin-comment-item" v-for="comment in comments" :key="comment._id">
        <div class="tk-admin-comment-meta">
          <tk-avatar :config="serverConfig" :avatar="comment.avatar" :mail="comment.mail" :link="comment.link" />
          <span v-if="!comment.link">{{ comment.nick }}</span>
          <a v-if="comment.link" :href="convertLink(comment.link)" target="_blank">{{ comment.nick }}</a>
          <span v-if="comment.mail">&nbsp;(<a :href="`mailto:${comment.mail}`">{{ comment.mail }}</a>)</span>
          <span v-if="comment.isSpam">&nbsp;(已隐藏)</span>
        </div>
        <div class="tk-content" v-html="comment.comment"></div>
        <div class="tk-admin-actions" slot="content">
          <el-button size="mini" type="text" @click="handleView(comment)">查看</el-button>
          <el-button size="mini" type="text" v-if="comment.isSpam" @click="handleSpam(comment, false)">显示</el-button>
          <el-button size="mini" type="text" v-if="!comment.isSpam" @click="handleSpam(comment, true)">隐藏</el-button>
          <el-button size="mini" type="text" @click="handleDelete(comment)">删除</el-button>
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
import { call, convertLink } from '../../js/utils'
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
      count: 0,
      pageSize: defaultPageSize,
      currentPage: 1
    }
  },
  methods: {
    convertLink,
    async getComments () {
      this.loading = true
      const res = await call(this.$tcb, 'COMMENT_GET_FOR_ADMIN', {
        per: this.pageSize,
        page: this.currentPage
      })
      if (res.result && !res.result.code) {
        this.count = res.result.count
        this.comments = res.result.data
      }
      this.loading = false
    },
    async getConfig () {
      const res = await call(this.$tcb, 'GET_CONFIG_FOR_ADMIN')
      if (res.result && !res.result.code) {
        this.serverConfig = res.result.config
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
      this.loading = true
      await call(this.$tcb, 'COMMENT_DELETE_FOR_ADMIN', {
        id: comment._id
      })
      await this.getComments()
      this.loading = false
    },
    async handleSpam (comment, isSpam) {
      this.loading = true
      await call(this.$tcb, 'COMMENT_SET_FOR_ADMIN', {
        id: comment._id,
        set: { isSpam }
      })
      await this.getComments()
      this.loading = false
    }
  },
  mounted () {
    this.getConfig()
    this.getComments()
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
.tk-admin-comment .el-pagination {
  color: #c0c4cc;
  margin-top: 1rem;
}
.tk-admin-comment /deep/ .el-input {
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}
.tk-admin-comment /deep/ .el-pagination__total,
.tk-admin-comment /deep/ .el-pagination__jump,
.tk-admin-comment /deep/ .el-pager li:hover,
.tk-admin-comment /deep/ .el-pager li.active {
  color: #ffffff;
}
.tk-admin-comment /deep/ .el-pager li,
.tk-admin-comment /deep/ .el-pagination.is-background .el-pager li,
.tk-admin-comment /deep/ .el-input__inner {
  background-color: transparent;
  color: #ffffff;
}
.tk-admin-comment /deep/ .el-icon-more::before,
.tk-admin-comment /deep/ .el-icon-d-arrow-left::before,
.tk-admin-comment /deep/ .el-icon-d-arrow-right::before {
  content: '...';
}
</style>

<template>
  <div class="tk-admin-comment" v-loading="loading">
    <div class="tk-admin-comment-list">
      <div class="tk-admin-comment-item" v-for="comment in comments" :key="comment._id">
        <div class="tk-admin-comment-meta">
          <tk-avatar :mail="comment.mail" :link="comment.link" />
          <span v-if="!comment.link">{{ comment.nick }}</span>
          <a v-if="comment.link" :href="convertLink(comment.link)" target="_blank">{{ comment.nick }}</a>
          <span v-if="comment.mail">&nbsp;(<a :href="`mailto:${comment.mail}`">{{ comment.mail }}</a>)</span>
          <span v-if="comment.isSpam">&nbsp;(已隐藏)</span>
        </div>
        <div class="tk-admin-comment-text">{{ comment.commentText }}</div>
        <div class="tk-admin-actions" slot="content">
          <el-button size="mini" type="text" @click="handleView(comment)">查看</el-button>
          <el-button size="mini" type="text" v-if="comment.isSpam" @click="handleSpam(comment, false)">显示</el-button>
          <el-button size="mini" type="text" v-if="!comment.isSpam" @click="handleSpam(comment, true)">隐藏</el-button>
          <el-button size="mini" type="text" @click="handleDelete(comment)">删除</el-button>
        </div>
      </div>
    </div>
    <el-pagination background
        layout="total, pager, jumper"
        :pager-count="5"
        :page-size="docPerPage"
        :total="count"
        @current-change="switchPage" />
  </div>
</template>

<script>
import { call, convertLink } from '../../js/utils'
import TkAvatar from './TkAvatar.vue'

const docPerPage = 5

export default {
  components: {
    TkAvatar
  },
  data () {
    return {
      loading: true,
      comments: [],
      count: 0,
      docPerPage,
      currentPage: 1
    }
  },
  methods: {
    convertLink,
    async getComments () {
      this.loading = true
      const res = await call(this.$tcb, 'COMMENT_GET_FOR_ADMIN', {
        per: this.docPerPage,
        page: this.currentPage
      })
      if (res.result && !res.result.code) {
        this.count = res.result.count
        this.comments = res.result.data
      }
      this.loading = false
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

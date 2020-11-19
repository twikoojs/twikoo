<template>
  <div class="tk-admin-comment" v-loading="loading">
    <el-table class="tk-admin-comment-list" :data="comments" stripe size="small">
      <el-table-column prop="nick" label="昵称" show-overflow-tooltip />
      <el-table-column prop="mail" label="邮箱" show-overflow-tooltip />
      <el-table-column prop="link" label="网址" show-overflow-tooltip />
      <el-table-column prop="commentText" label="评论" show-overflow-tooltip />
      <el-table-column width="150" label="操作">
        <template slot-scope="scope">
          <el-button size="mini" @click="handleView(scope.row)" type="primary">查看</el-button>
          <el-button size="mini" @click="handleDelete(scope.row)" type="danger">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination background
        layout="total, pager, jumper"
        :pager-count="5"
        :page-size="docPerPage"
        :total="count"
        @current-change="switchPage" />
  </div>
</template>

<script>
import { call } from '../../js/utils'

const docPerPage = 10

export default {
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
      window.open(comment.href || comment.url)
    },
    async handleDelete (comment) {
      this.loading = true
      await call(this.$tcb, 'COMMENT_DELETE_FOR_ADMIN', {
        id: comment._id
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
  background-color: #00000010;
}
.tk-admin-comment-list {
  display: grid;
  overflow: auto;
}
.tk-admin-comment-item {
  display: flex;
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
.tk-admin-comment .el-table,
.tk-admin-comment .el-table::before,
.tk-admin-comment /deep/ .el-table th,
.tk-admin-comment /deep/ .el-table tr,
.tk-admin-comment /deep/ .el-pager li,
.tk-admin-comment /deep/ .el-pagination.is-background .el-pager li,
.tk-admin-comment /deep/ .el-input__inner {
  background-color: transparent;
  color: #ffffff;
}
.tk-admin-comment /deep/ .el-table--striped .el-table__body tr.el-table__row--striped td,
.tk-admin-comment /deep/ .el-table--enable-row-hover .el-table__body tr:hover>td {
  background-color: #ffffff10;
}
.tk-admin-comment /deep/ .el-loading-mask {
  background-color: #00000099;
}
.tk-admin-comment /deep/ .el-table td,
.tk-admin-comment /deep/ .el-table th.is-leaf {
  border: none;
}
.tk-admin-comment /deep/ .el-icon-more::before,
.tk-admin-comment /deep/ .el-icon-d-arrow-left::before,
.tk-admin-comment /deep/ .el-icon-d-arrow-right::before {
  content: '...';
}
</style>

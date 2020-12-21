<template>
  <div class="tk-pagination">
    <div class="tk-pagination-options" v-if="!!pageCount">
      <div>共 {{ total }} 条</div>
      <el-input
          class="el-pagination__editor is-in-pagination"
          type="number"
          min="1"
          max="100"
          :value="userPageSize ? userPageSize : pageSize"
          @input="handleInputPageSize"
          @change="pageSizeChamge" />
      <span>条/页</span>
    </div>
    <div class="tk-pagination-pagers">
      <div class="tk-pagination-pager"
          :class="{ __current: pager.page === currentPage }"
          v-for="pager in pagers"
          :key="pager.page"
          @click="currentChange(pager.page)">{{ pager.title }}</div>
    </div>
    <div class="tk-pagination-options" v-if="!!pageCount">
      <span>前往</span>
      <el-input
          class="el-pagination__editor is-in-pagination"
          type="number"
          min="1"
          :max="pageCount"
          :value="userInput ? userInput : currentPage"
          @input="handleInput"
          @change="currentChange" />
      <span>页</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    pageSize: {
      type: Number,
      default: 10
    },
    total: {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      currentPage: 1,
      userInput: 0,
      userPageSize: 0,
      pagers: []
    }
  },
  computed: {
    pageCount () {
      return Math.ceil(this.total / this.pageSize)
    }
  },
  methods: {
    generatePager () {
      const pagers = []
      for (let page = 1; page <= this.pageCount; page++) {
        if (Math.abs(this.currentPage - page) < 3 ||
            page === 1 ||
            page === this.pageCount) {
          pagers.push({ title: `${page}`, page })
        } else if (Math.abs(this.currentPage - page) < 4) {
          pagers.push({ title: '...', page })
        }
      }
      this.pagers = pagers
    },
    currentChange (pageNum) {
      this.currentPage = parseInt(pageNum)
      if (this.currentPage > this.pageCount) this.currentPage = this.pageCount
      this.userInput = 0
      this.$emit('current-change', this.currentPage)
      this.generatePager()
    },
    pageSizeChamge (pageSize) {
      this.userPageSize = 0
      this.$emit('page-size-change', parseInt(pageSize))
    },
    handleInput (pageNum) {
      this.userInput = parseInt(pageNum)
    },
    handleInputPageSize (pageSize) {
      this.userPageSize = parseInt(pageSize)
    }
  },
  watch: {
    total: {
      handler () {
        this.generatePager()
      },
      immediate: true
    },
    pageSize: {
      handler () {
        this.generatePager()
      }
    }
  }
}
</script>

<style scoped>
.tk-pagination,
.tk-pagination-pagers {
  display: flex;
}
.tk-pagination {
  width: 100%;
  align-items: center;
  justify-content: space-between;
}
.tk-pagination-options {
  display: flex;
  align-items: center;
}
.tk-pagination-pager {
  width: 2em;
  height: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tk-pagination-pager.__current {
  background-color: #409eff;
  pointer-events: none;
}
.tk-pagination .el-input {
  width: 50px;
}
.tk-pagination .el-input /deep/ .el-input__inner {
  padding: 0;
  height: 28px;
  text-align: center;
  -moz-appearance: textfield;
  appearance: textfield;
}
.tk-pagination .el-input /deep/ .el-input__inner::-webkit-inner-spin-button,
.tk-pagination .el-input /deep/ .el-input__inner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
</style>

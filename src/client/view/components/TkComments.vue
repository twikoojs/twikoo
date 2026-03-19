<template>
  <div class="tk-comments">
    <tk-submit @load="initComments" :config="config" />
    <div class="tk-comments-container" v-loading="loading">
      <div class="tk-comments-title">
        <span class="tk-comments-count" :class="{ __hidden: !comments.length }">
          <span>{{ count }}</span>
          <span>{{ t('COMMENTS_COUNT_SUFFIX') }}</span>
        </span>
        <span class="tk-comments-actions">
          <span class="tk-comments-sort" v-if="!loading && comments.length && config.SHOW_ORDER !== 'false'">
            <button
              class="tk-sort-item"
              type="button"
              :class="{ __active: currentSort === 'newest' }"
              @click="setSort('newest')">{{ t('COMMENTS_SORT_NEWEST') }}</button>
            <button
              class="tk-sort-item"
              type="button"
              :class="{ __active: currentSort === 'oldest' }"
              @click="setSort('oldest')">{{ t('COMMENTS_SORT_OLDEST') }}</button>
            <button
              class="tk-sort-item"
              type="button"
              :class="{ __active: currentSort === 'popular' }"
              @click="setSort('popular')">{{ t('COMMENTS_SORT_POPULAR') }}</button>
          </span>
          <span class="tk-icon __comments" v-if="!loading && !loadingMore" v-html="iconRefresh" @click="refresh"
            ></span><span class="tk-icon __comments" v-if="showAdminEntry" v-html="iconSetting" @click="openAdmin"
            ></span>
        </span>
      </div>
      <div class="tk-comments-no" v-if="!loading && !comments.length">
        <span v-if="!errorMessage">{{ t('COMMENTS_NO_COMMENTS') }}</span>
        <span v-if="errorMessage" class="tk-comments-error">{{ errorMessage }}</span>
      </div>
      <tk-comment v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :replying="replyId === comment.id"
        :config="config"
        @reply="onReply"
        @load="initComments" />
      <div class="tk-expand-wrap" v-if="showExpand && !loading">
        <div class="tk-expand" @click="onExpand" v-loading="loadingMore">{{ t('COMMENTS_EXPAND') }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import iconSetting from '@fortawesome/fontawesome-free/svgs/solid/cog.svg'
import iconRefresh from '@fortawesome/fontawesome-free/svgs/solid/sync.svg'
import Vue from 'vue'
import { call, getUrl, t } from '../../utils'
import { app } from '../index'
import TkComment from './TkComment.vue'
import TkSubmit from './TkSubmit.vue'

export default {
  components: {
    TkSubmit,
    TkComment
  },
  props: {
    showAdminEntry: Boolean
  },
  data () {
    return {
      loading: true,
      loadingMore: false,
      errorMessage: '',
      config: {},
      comments: [],
      showExpand: true,
      count: 0,
      replyId: '',
      currentSort: 'newest',
      iconSetting,
      iconRefresh
    }
  },
  methods: {
    t,
    async initConfig () {
      const result = await call(this.$tcb, 'GET_CONFIG')
      if (result && result.result && result.result.config) {
        this.config = result.result.config
        Vue.prototype.$twikoo.serverConfig = result.result.config
      }
    },
    async initComments () {
      this.loading = true
      const url = getUrl(this.$twikoo.path)
      await this.getComments({ url, sort: this.currentSort })
      this.loading = false
    },
    refresh () {
      this.comments = []
      this.initComments()
    },
    setSort (sort) {
      if (this.currentSort === sort) return
      this.currentSort = sort
      this.comments = []
      this.initComments()
    },
    async onExpand () {
      if (this.loadingMore) return
      this.loadingMore = true
      const url = getUrl(this.$twikoo.path)
      const before = this.comments
        .filter((item) => !item.top)
        .map((item) => item.created)
        .sort((a, b) => a - b)[0]
      await this.getComments({ url, before, sort: this.currentSort })
      this.loadingMore = false
    },
    onCommentLoaded () {
      typeof this.$twikoo.onCommentLoaded === 'function' && this.$twikoo.onCommentLoaded()
    },
    async getComments (event) {
      try {
        const comments = await call(this.$tcb, 'COMMENT_GET', event)
        if (comments && comments.result && comments.result.data) {
          this.comments = event.before ? this.comments.concat(comments.result.data) : comments.result.data
          this.showExpand = comments.result.more
          this.count = comments.result.count || this.comments.length || 0
          this.$nextTick(this.onCommentLoaded)
        }
      } catch (e) {
        this.errorMessage = e.message
      }
    },
    onReply (id) {
      this.replyId = id
    },
    openAdmin () {
      this.$emit('admin')
    }
  },
  mounted () {
    this.initConfig()
    this.initComments()
    // Re-fetch config when admin saves settings (e.g. captcha provider change)
    app.$on('configUpdated', this.initConfig)
  }
}
</script>

<style>
.tk-comments-title {
  font-size: 1.25rem;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.tk-comments-count.__hidden {
  visibility: hidden;
}
.tk-comments-count {
  flex-shrink: 0;
  white-space: nowrap;
}
.tk-comments-actions {
  display: flex;
  align-items: center;
  gap: 0.5em;
  white-space: nowrap;
}
.tk-comments-container {
  min-height: 10rem;
  display: flex;
  flex-direction: column;
}
.tk-comments-no {
  flex: 1;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tk-comments-error {
  font-size: 0.75em;
  color: #ff0000;
}
.tk-comments-sort {
  display: flex;
  align-items: center;
  gap: 0.75em;
  margin-right: 0.5em;
  line-height: 1;
}
.tk-sort-item {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  line-height: 1;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: rgba(64, 158, 255, 0.6);
}
.tk-sort-item.__active {
  color: #409eff;
}
.tk-sort-item:focus {
  outline: none;
  color: #409eff;
}
.tk-icon.__comments {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  height: 0.75rem;
  width: 0.75rem;
  line-height: 0;
  flex-shrink: 0;
  cursor: pointer;
  color: #409eff;
}
.tk-icon.__comments svg {
  display: block;
  width: 100%;
  height: 100%;
}
.twikoo div.code-toolbar {
  position: relative;
  border-radius: .3em
}
.twikoo div.code-toolbar>.toolbar {
  position: absolute;
  right: 4px;
  top: 4px;
  font-size: .8125rem;
  font-weight: 500;
  display: flex;
}
.twikoo div.code-toolbar>.toolbar>.toolbar-item {
  margin-left: .3em
}
.twikoo div.code-toolbar>.toolbar>.toolbar-item>a,
.twikoo div.code-toolbar>.toolbar>.toolbar-item>button,
.twikoo div.code-toolbar>.toolbar>.toolbar-item>span {
  padding: 2px 4px;
  border-radius: .3em;
}
.twikoo div.code-toolbar>.toolbar>.toolbar-item>button {
  border: 1px solid rgba(128, 128, 128, 0.31);
}
.twikoo div.code-toolbar>.toolbar>.toolbar-item>button:hover {
  cursor: pointer;
}
</style>

<template>
  <div class="tk-admin-export">
    <div class="tk-admin-warn tk-admin-import-warn">
      <p>{{ t('ADMIN_EXPORT_WARN') }}</p>
    </div>
    <el-button size="small" @click="doExport('comment')" :disabled="loading">{{ t('ADMIN_EXPORT_COMMENT') }}</el-button>
    <el-button size="small" @click="doExport('counter')" :disabled="loading">{{ t('ADMIN_EXPORT_COUNTER') }}</el-button>
  </div>
</template>

<script>
import { call, t } from '../../utils'

export default {
  data () {
    return {
      loading: false
    }
  },
  methods: {
    t,
    async doExport (collection) {
      this.loading = true
      try {
        const result = await call(this.$tcb, 'COMMENT_EXPORT_FOR_ADMIN', {
          collection
        })
        if (result.result.data) {
          this.downloadJson(`twikoo-${collection}.json`, result.result.data)
        }
      } finally {
        this.loading = false
      }
    },
    downloadJson (fileName, json) {
      const jsonStr = (json instanceof Object) ? JSON.stringify(json, null, 2) : json
      const url = window.URL || window.webkitURL || window
      const blob = new Blob([jsonStr])
      const saveLink = document.createElementNS('http://www.w3.org/1999/xhtml', 'a')
      saveLink.href = url.createObjectURL(blob)
      saveLink.download = fileName
      saveLink.click()
    }
  }
}
</script>

<template>
  <div class="tk-admin-import">
    <div class="tk-admin-warn tk-admin-import-warn">
      <p>{{ t('ADMIN_IMPORT_WARN') }}</p>
      <p>{{ warnText[source] }}</p>
    </div>
    <div class="tk-admin-import-label">{{ t('ADMIN_IMPORT_SELECT_SOURCE') }}</div>
    <select v-model="source">
      <option disabled value="">{{ t('ADMIN_IMPORT_SELECT') }}</option>
      <option value="valine">Valine (JSON)</option>
      <option value="disqus">Disqus (XML)</option>
      <option value="artalk">Artalk (JSON)</option>
      <option value="twikoo">Twikoo (JSON)</option>
    </select>
    <div class="tk-admin-import-label">{{ t('ADMIN_IMPORT_SELECT_FILE') }}</div>
    <input type="file" value="" ref="inputFile" />
    <el-button size="small" @click="uploadFile" :disabled="loading">{{ t('ADMIN_IMPORT_START') }}</el-button>
    <el-input type="textarea" :rows="10" :placeholder="t('ADMIN_IMPORT_LOG')" readonly v-model="logText" ref="logTextArea" />
  </div>
</template>

<script>
import { call, readAsText, t } from '../../js/utils'

export default {
  data () {
    return {
      loading: false,
      source: '',
      logText: '',
      warnText: {
        valine: t('ADMIN_IMPORT_TIP_VALINE'),
        disqus: t('ADMIN_IMPORT_TIP_DISQUS'),
        artalk: t('ADMIN_IMPORT_TIP_ARTALK'),
        twikoo: ''
      }
    }
  },
  methods: {
    t,
    async uploadFile () {
      if (!this.source) {
        this.log(t('ADMIN_IMPORT_SOURCE_REQUIRED'))
        return
      }
      const filePath = this.$refs.inputFile.files[0]
      if (!filePath) {
        this.log(t('ADMIN_IMPORT_FILE_REQUIRED'))
        return
      }
      this.log(t('ADMIN_IMPORT_START'))
      this.loading = true
      try {
        if (this.$tcb) {
          const result = await this.$tcb.app.uploadFile({
            cloudPath: `import/${Date.now()}`,
            filePath,
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              this.log(`${t('ADMIN_IMPORT_UPLOADING')}${percentCompleted}%`)
            }
          })
          this.log(`${t('ADMIN_IMPORT_UPLOADED')}${result.fileID}`)
          await this.importFile(result.fileID)
        } else {
          await this.importFileToVercel(filePath)
        }
      } catch (e) {
        this.log(e.message)
      }
      this.loading = false
    },
    async importFile (fileID) {
      this.log(`${t('ADMIN_IMPORT_IMPORTING')}${this.source}`)
      const result = await call(this.$tcb, 'COMMENT_IMPORT_FOR_ADMIN', {
        fileId: fileID,
        source: this.source
      })
      this.logText += result.result.log
      this.log(`${t('ADMIN_IMPORT_IMPORTED')}${this.source}`)
    },
    async importFileToVercel (filePath) {
      this.log(`${t('ADMIN_IMPORT_IMPORTING')}${this.source}`)
      const result = await call(this.$tcb, 'COMMENT_IMPORT_FOR_ADMIN', {
        file: await readAsText(filePath),
        source: this.source
      })
      this.logText += result.result.log
      this.log(`${t('ADMIN_IMPORT_IMPORTED')}${this.source}`)
    },
    log (message) {
      this.logText += `${new Date().toLocaleString()} ${message}\n`
      this.$nextTick(this.scrollLogToBottom)
    },
    scrollLogToBottom () {
      if (this.$refs.logTextArea) {
        const textareaEl = this.$refs.logTextArea.$refs.textarea
        textareaEl.scrollTop = textareaEl.scrollHeight
      }
    }
  }
}
</script>

<style scoped>
.tk-admin-import {
  display: flex;
  flex-direction: column;
}
.tk-admin-import-label {
  margin-top: 1em;
  font-size: 1.25rem;
  font-weight: bold;
}
select,
input,
.el-button,
.el-textarea {
  margin-top: 1em;
}
</style>

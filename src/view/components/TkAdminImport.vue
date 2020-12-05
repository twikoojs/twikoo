<template>
  <div class="tk-admin-import">
    <div class="tk-admin-import-warn">
      <p>支持从其他评论系统的备份文件导入评论。</p>
      <p>数据是安全的，导入功能完全在您的云环境进行。</p>
      <p>建议在导入前备份 comment 数据库。</p>
      <p>{{ warnText[source] }}</p>
    </div>
    <div class="tk-admin-import-label">选择源系统</div>
    <select v-model="source">
      <option disabled value="">请选择</option>
      <option value="valine">Valine (JSON)</option>
      <option value="disqus">Disqus (XML)</option>
      <option value="artalk">Artalk (JSON)</option>
    </select>
    <div class="tk-admin-import-label">选择文件</div>
    <input type="file" value="" ref="inputFile" />
    <el-button size="small" @click="uploadFile" :disabled="loading">开始导入</el-button>
    <el-input type="textarea" :rows="10" placeholder="日志" readonly v-model="logText" ref="logTextArea" />
  </div>
</template>

<script>
import { call } from '../../js/utils'

export default {
  data () {
    return {
      loading: false,
      source: '',
      logText: '',
      warnText: {
        valine: '请上传 JSON 格式的 Valine 导出文件，文件名通常为 Comment.json',
        disqus: '请上传 XML 格式的 Disqus 导出文件，文件名通常为 [网站名称]-[导出时间]-all.xml',
        artalk: '请上传 JSON 格式的 Artalk 导出文件，文件名通常为 comments.data.json'
      }
    }
  },
  methods: {
    async uploadFile () {
      if (!this.source) {
        this.log('未选择源系统')
        return
      }
      const filePath = this.$refs.inputFile.files[0]
      if (!filePath) {
        this.log('未选择文件')
        return
      }
      this.log('开始导入')
      this.loading = true
      try {
        const result = await this.$tcb.app.uploadFile({
          cloudPath: `import/${Date.now()}`,
          filePath,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            this.log(`已上传 ${percentCompleted}%`)
          }
        })
        this.log(`上传完成 ${result.fileID}`)
        await this.importFile(result.fileID)
      } catch (e) {
        this.log(e.message)
      }
      this.loading = false
    },
    async importFile (fileID) {
      this.log(`开始导入 ${this.source} 数据`)
      const result = await call(this.$tcb, 'COMMENT_IMPORT_FOR_ADMIN', {
        fileId: fileID,
        source: this.source
      })
      this.logText += result.result.log
      this.log(`完成导入 ${this.source} 数据`)
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
.tk-admin-import-warn {
  padding: 1rem 1.5rem;
  background-color: #fff7d0;
  border-left: 0.5rem solid #e7c000;
  color: #6b5900;
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

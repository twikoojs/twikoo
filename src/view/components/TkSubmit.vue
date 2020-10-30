<template>
  <div class="tk-submit">
    <div class="tk-row">
      <tk-avatar :mail="mail" />
      <div class="tk-col">
        <tk-meta-input :nick="nick" :mail="mail" :link="link" @update="onMetaUpdate" />
        <el-input class="tk-input"
            type="textarea"
            v-model="comment"
            placeholder="请输入内容"
            :autosize="{ minRows: 3 }"
            @input="updatePreview" />
      </div>
    </div>
    <div class="tk-row actions">
      <a class="tk-action-icon" alt="Markdown is supported" href="https://guides.github.com/features/mastering-markdown/" target="_blank" v-html="iconMarkdown"></a>
      <el-button class="tk-cancel"
          v-if="!!replyId"
          size="small"
          @click="cancel">取消</el-button>
      <el-button class="tk-preview"
          size="small"
          @click="preview">预览</el-button>
      <el-button class="tk-send"
          type="primary"
          size="small"
          :disabled="!canSend"
          @click="send">{{ isSending ? '发送中' : '发送' }}</el-button>
    </div>
    <div class="tk-preview-container" v-if="isPreviewing" v-html="commentHtml"></div>
  </div>
</template>

<script>
import iconMarkdown from '@fortawesome/fontawesome-free/svgs/brands/markdown.svg'
import TkAvatar from './TkAvatar.vue'
import TkMetaInput from './TkMetaInput.vue'
import { marked } from '../../js/utils'

export default {
  components: {
    TkAvatar,
    TkMetaInput
  },
  props: {
    replyId: String,
    pid: String
  },
  data () {
    return {
      isSending: false,
      isPreviewing: false,
      comment: '',
      commentHtml: '',
      nick: '',
      mail: '',
      link: '',
      iconMarkdown
    }
  },
  computed: {
    canSend () {
      return !this.isSending
          && !!this.nick
          && !!this.mail
          && !!this.comment
    }
  },
  methods: {
    onMetaUpdate (metaData) {
      this.nick = metaData.nick
      this.mail = metaData.mail
      this.link = metaData.link
    },
    cancel () {
      this.$emit('cancel')
    },
    preview () {
      this.isPreviewing = !this.isPreviewing
      this.updatePreview()
    },
    updatePreview () {
      if (this.isPreviewing) {
        this.commentHtml = marked(this.comment)
      }
    },
    async send () {
      this.isSending = true
      const comment = {
        nick: this.nick,
        mail: this.mail,
        link: this.link,
        ua: navigator.userAgent,
        url: window.location.pathname,
        href: window.location.href,
        comment: marked(this.comment),
        pid: this.pid ? this.pid : this.replyId,
        rid: this.replyId
      }
      const id = await this.$tcb.app.callFunction({
        name: 'comment-submit',
        data: comment
      })
      if (id && id.result && id.result.id) {
        this.onSendComplete()
      }
    },
    onSendComplete () {
      this.comment = ''
      this.isSending = false
      this.$emit('load')
    }
  }
}
</script>

<style scoped>
.tk-submit {
  display: flex;
  flex-direction: column;
}
.tk-row {
  display: flex;
  flex-direction: row;
}
.tk-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.tk-meta-input {
  margin-bottom: 0.5rem;
}
.tk-row.actions {
  margin-top: 1rem;
  margin-bottom: 1rem;
  margin-left: 3rem;
  justify-content: flex-end;
}
.tk-action-icon {
  align-self: center;
  display: inline-block;
  width: 1.25em;
  line-height: 0;
  margin-right: 10px;
}
.tk-action-icon /deep/ svg {
  fill: #909399;
}
.tk-avatar {
  margin-right: 1rem;
}
.tk-input {
  flex: 1;
}
.tk-preview-container {
  margin-left: 3rem;
  margin-bottom: 1rem;
  padding: 5px 15px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
</style>

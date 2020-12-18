<template>
  <div class="tk-submit">
    <div class="tk-row">
      <tk-avatar :config="config" :mail="mail" />
      <div class="tk-col">
        <tk-meta-input :nick="nick" :mail="mail" :link="link" @update="onMetaUpdate" />
        <el-input class="tk-input"
            type="textarea"
            ref="textarea"
            v-model="comment"
            placeholder="请输入内容"
            :autosize="{ minRows: 3 }"
            @input="updatePreview"
            @keyup.enter.native="onEnterKeyUp($event)" />
      </div>
    </div>
    <div class="tk-row actions">
      <div class="tk-row-actions-start">
        <div class="tk-action-icon OwO" v-show="config.SHOW_EMOTION === 'true'" ref="owo"></div>
        <div class="tk-action-icon" v-show="config.SHOW_IMAGE === 'true'" v-html="iconImage" @click="openSelectImage"></div>
        <input class="tk-input-image" type="file" accept="image/*" value="" ref="inputFile" @change="onSelectImage" />
        <div class="tk-error-message">{{ errorMessage }}</div>
      </div>
      <a class="tk-action-icon __markdown"
          alt="Markdown is supported"
          href="https://guides.github.com/features/mastering-markdown/"
          target="_blank"
          rel="noopener noreferrer"
          v-html="iconMarkdown"></a>
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
import iconEmotion from '@fortawesome/fontawesome-free/svgs/regular/laugh.svg'
import iconImage from '@fortawesome/fontawesome-free/svgs/regular/image.svg'
import TkAvatar from './TkAvatar.vue'
import TkMetaInput from './TkMetaInput.vue'
import { marked, call, logger } from '../../js/utils'
import OwO from '../lib/owo'

const imageTypes = [
  'apng',
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp'
]

export default {
  components: {
    TkAvatar,
    TkMetaInput
  },
  props: {
    replyId: String,
    pid: String,
    config: Object
  },
  data () {
    return {
      isSending: false,
      isPreviewing: false,
      errorMessage: '',
      owo: null,
      comment: '',
      commentHtml: '',
      nick: '',
      mail: '',
      link: '',
      iconMarkdown,
      iconImage
    }
  },
  computed: {
    canSend () {
      return !this.isSending &&
        !!this.nick &&
        !!this.mail &&
        !!this.comment.trim()
    },
    textarea () {
      return this.$refs.textarea ? this.$refs.textarea.$refs.textarea : null
    }
  },
  methods: {
    initOwo () {
      this.owo = new OwO({
        logo: iconEmotion, // OwO button text, default: `OωO表情`
        container: this.$refs.owo, // OwO container, default: `document.getElementsByClassName('OwO')[0]`
        target: this.textarea, // OwO target input or textarea, default: `document.getElementsByTagName('textarea')[0]`
        api: 'https://cdn.jsdelivr.net/gh/imaegoo/emotion@8d0d03b/owo.json', // OwO Emoticon data api, default: `https://cdn.jsdelivr.net/npm/owo/demo/OwO.json`
        position: 'down', // OwO body position, default: `down`
        maxHeight: '250px' // OwO body max-height, default: `250px`
      })
    },
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
      const sendResult = await call(this.$tcb, 'COMMENT_SUBMIT', comment)
      if (sendResult && sendResult.result && sendResult.result.id) {
        this.isSending = false
        this.comment = ''
        this.errorMessage = ''
        this.$emit('load')
      } else {
        this.isSending = false
        logger.error('评论失败', sendResult)
        this.errorMessage = `评论失败: ${sendResult.result.message}`
      }
    },
    addEventListener () {
      if (this.textarea) {
        this.textarea.addEventListener('paste', this.onPaste)
      }
    },
    onBgImgChange () {
      if (this.config.COMMENT_BG_IMG && this.textarea) {
        this.textarea.style['background-image'] = `url("${this.config.COMMENT_BG_IMG}")`
      }
    },
    onEnterKeyUp (event) {
      // 按 Ctrl + Enter / Command + Enter 发送
      if ((event.ctrlKey || event.metaKey) && this.canSend) {
        this.send()
        event.preventDefault()
      }
    },
    openSelectImage () {
      this.$refs.inputFile.click()
    },
    onSelectImage () {
      const photo = this.$refs.inputFile.files[0]
      this.parseAndUploadPhoto(photo)
    },
    onPaste (e) {
      if (!e.clipboardData) return
      let photo
      if (e.clipboardData.files[0]) {
        photo = e.clipboardData.files[0]
      } else if (e.clipboardData.items[0] && e.clipboardData.items[0].getAsFile()) {
        photo = e.clipboardData.items[0].getAsFile()
      }
      this.parseAndUploadPhoto(photo)
    },
    parseAndUploadPhoto (photo) {
      if (!photo || this.config.SHOW_IMAGE !== 'true') return
      const nameSplit = photo.name.split('.')
      const fileType = nameSplit.length > 1 ? nameSplit.pop() : ''
      if (imageTypes.indexOf(fileType) === -1) return
      const userId = this.$tcb.auth.currentUser.uid
      const fileIndex = `${Date.now()}-${userId}`
      const fileName = nameSplit.join('.')
      this.paste(this.getImagePlaceholder(fileIndex, fileType))
      this.uploadPhoto(fileIndex, fileName, fileType, photo)
    },
    async uploadPhoto (fileIndex, fileName, fileType, photo) {
      try {
        const uploadResult = await this.$tcb.app.uploadFile({
          cloudPath: `tk-img/${fileIndex}.${fileType}`,
          filePath: photo
        })
        if (uploadResult.fileID) {
          const tempUrlResult = await this.$tcb.app.getTempFileURL({ fileList: [uploadResult.fileID] })
          const tempFileUrl = tempUrlResult.fileList[0].tempFileURL
          this.comment = this.comment.replace(this.getImagePlaceholder(fileIndex, fileType), `![${fileName}](${tempFileUrl})`)
        }
      } catch (e) {
        console.error(e)
      }
    },
    paste (text) {
      if (document.selection) {
        document.selection.createRange().text = text
      } else if (this.textarea.selectionStart || this.textarea.selectionStart === 0) {
        const n = this.textarea.selectionStart
        const r = this.textarea.selectionEnd
        this.comment = this.comment.substring(0, n) + text + this.comment.substring(r, this.comment.length)
        this.textarea.selectionStart = n + text.length
        this.textarea.selectionEnd = n + text.length
      } else {
        this.comment += text
      }
    },
    getImagePlaceholder (fileIndex, fileType) {
      return `![图片上传中${fileIndex}.${fileType}]()`
    }
  },
  mounted () {
    this.initOwo()
    this.addEventListener()
    this.onBgImgChange()
  },
  watch: {
    'config.COMMENT_BG_IMG': function () {
      this.onBgImgChange()
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
  margin-left: 3.5rem;
  align-items: center;
  justify-content: flex-end;
}
.tk-action-icon {
  align-self: center;
  display: inline-block;
  width: 1.25em;
  line-height: 0;
  margin-right: 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.tk-action-icon /deep/ svg:hover {
  opacity: 0.8;
}
.tk-action-icon.__markdown /deep/ svg {
  fill: #909399;
}
.tk-error-message {
  word-break: break-all;
  color: #ff0000;
  font-size: 0.75em;
  flex-shrink: 1;
}
.tk-avatar {
  margin-right: 1rem;
}
.tk-input-image {
  display: none;
}
.tk-input {
  flex: 1;
}
.tk-input /deep/ .el-textarea__inner {
  background-position: right bottom;
  background-repeat: no-repeat;
}
.tk-preview-container {
  margin-left: 3rem;
  margin-bottom: 1rem;
  padding: 5px 15px;
  border: 1px solid #80808050;
  border-radius: 4px;
}
.tk-row-actions-start {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}
</style>

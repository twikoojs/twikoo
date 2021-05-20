<template>
  <div class="tk-submit">
    <div class="tk-row">
      <tk-avatar :config="config" :mail="mail" />
      <div class="tk-col">
        <tk-meta-input :nick="nick" :mail="mail" :link="link" @update="onMetaUpdate" :config="config" />
        <el-input class="tk-input"
            type="textarea"
            ref="textarea"
            v-model="comment"
            :placeholder="config.COMMENT_PLACEHOLDER ? config.COMMENT_PLACEHOLDER.replace(/<br>/g, '\n') : ''"
            :autosize="{ minRows: 3 }"
            @input="onCommentInput"
            @keyup.enter.native="onEnterKeyUp($event)" />
      </div>
    </div>
    <div class="tk-row actions">
      <div class="tk-row-actions-start">
        <div class="tk-action-icon OwO" v-show="config.SHOW_EMOTION === 'true'" v-clickoutside="closeOwo" ref="owo"></div>
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
          @click="cancel">{{ t('SUBMIT_CANCEL') }}</el-button>
      <el-button class="tk-preview"
          size="small"
          @click="preview">{{ t('SUBMIT_PREVIEW') }}</el-button>
      <el-button class="tk-send"
          type="primary"
          size="small"
          :disabled="!canSend"
          @click="send">{{ isSending ? t('SUBMIT_SENDING') : t('SUBMIT_SEND') }}</el-button>
    </div>
    <div class="tk-preview-container" v-if="isPreviewing" v-html="commentHtml" ref="comment-preview"></div>
  </div>
</template>

<script>
import iconMarkdown from '@fortawesome/fontawesome-free/svgs/brands/markdown.svg'
import iconEmotion from '@fortawesome/fontawesome-free/svgs/regular/laugh.svg'
import iconImage from '@fortawesome/fontawesome-free/svgs/regular/image.svg'
import Clickoutside from 'element-ui/src/utils/clickoutside'
import TkAvatar from './TkAvatar.vue'
import TkMetaInput from './TkMetaInput.vue'
import { marked, call, logger, renderLinks, renderMath, renderCode, initOwoEmotion, initMarkedOwo, t, getUrl } from '../../js/utils'
import OwO from '../../lib/owo'

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
  directives: {
    Clickoutside
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
      isMetaValid: false,
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
        !!this.isMetaValid &&
        !!this.comment.trim()
    },
    textarea () {
      return this.$refs.textarea ? this.$refs.textarea.$refs.textarea : null
    }
  },
  methods: {
    t,
    initDraft () {
      const draft = localStorage.getItem('twikoo-draft')
      if (!this.comment && draft) {
        this.comment = draft
      }
    },
    saveDraft () {
      localStorage.setItem('twikoo-draft', this.comment)
    },
    async initOwo () {
      if (this.config.SHOW_EMOTION === 'true') {
        const odata = await initOwoEmotion(this.config.EMOTION_CDN || 'https://cdn.jsdelivr.net/gh/imaegoo/emotion/owo.json')
        this.owo = new OwO({
          logo: iconEmotion, // OwO button text, default: `OωO表情`
          container: this.$refs.owo, // OwO container, default: `document.getElementsByClassName('OwO')[0]`
          target: this.textarea, // OwO target input or textarea, default: `document.getElementsByTagName('textarea')[0]`
          odata,
          position: 'down', // OwO body position, default: `down`
          maxHeight: '250px' // OwO body max-height, default: `250px`
        })
        marked.setOptions({ odata: initMarkedOwo(odata) })
      }
    },
    onMetaUpdate (updates) {
      this.nick = updates.meta.nick
      this.mail = updates.meta.mail
      this.link = updates.meta.link
      this.isMetaValid = updates.valid
    },
    cancel () {
      this.$emit('cancel')
    },
    onCommentInput () {
      this.saveDraft()
      this.updatePreview()
    },
    preview () {
      this.isPreviewing = !this.isPreviewing
      this.updatePreview()
    },
    updatePreview () {
      if (this.isPreviewing) {
        this.commentHtml = marked(this.comment)
        this.$nextTick(() => {
          renderLinks(this.$refs['comment-preview'])
          renderMath(this.$refs['comment-preview'], this.$twikoo.katex)
          if (this.config.HIGHLIGHT === 'true') {
            renderCode(this.$refs['comment-preview'], this.config.HIGHLIGHT_THEME)
          }
        })
      }
    },
    async send () {
      this.isSending = true
      const url = getUrl(this.$twikoo.path)
      const comment = {
        nick: this.nick,
        mail: this.mail,
        link: this.link,
        ua: navigator.userAgent,
        url,
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
        this.saveDraft()
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
    closeOwo () {
      if (this.owo && this.owo.container.classList.contains('OwO-open')) {
        this.owo.toggle()
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
      if (this.config.IMAGE_CDN === '7bu' || !this.$tcb) {
        this.uploadPhotoTo7Bu(fileIndex, fileName, fileType, photo)
      } else {
        this.uploadPhotoToQcloud(fileIndex, fileName, fileType, photo)
      }
    },
    async uploadPhotoToQcloud (fileIndex, fileName, fileType, photo) {
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
    uploadPhotoTo7Bu (fileIndex, fileName, fileType, photo) {
      return new Promise((resolve) => {
        try {
          const url = 'https://7bu.top/api/upload'
          const formData = new FormData()
          const xhr = new XMLHttpRequest()
          formData.append('image', photo)
          xhr.onreadystatechange = () => {
            if (xhr.readyState === 4 && xhr.status === 200) {
              const uploadResult = JSON.parse(xhr.responseText)
              this.comment = this.comment.replace(this.getImagePlaceholder(fileIndex, fileType), `![${fileName}](${uploadResult.data.url})`)
              resolve()
            }
          }
          xhr.open('POST', url)
          xhr.send(formData)
        } catch (e) {
          console.error(e)
        }
      })
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
    this.initDraft()
    this.initOwo()
    this.addEventListener()
    this.onBgImgChange()
  },
  watch: {
    'config.SHOW_EMOTION': function () {
      this.initOwo()
    },
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
  position: relative;
  margin-top: 1rem;
  margin-bottom: 1rem;
  margin-left: 3.5rem;
  align-items: center;
  justify-content: flex-end;
}
.tk-row-actions-start {
  flex: 1;
  display: flex;
  align-items: center;
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
</style>

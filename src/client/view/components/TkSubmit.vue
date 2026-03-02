<template>
  <div class="tk-submit tk-fade-in" ref="tk-submit">
    <div class="tk-row">
      <tk-avatar :config="config" :mail="mail" :nick="nick" />
      <div class="tk-col">
        <tk-meta-input :nick="nick" :mail="mail" :link="link" @update="onMetaUpdate" :config="config" />
        <el-input class="tk-input"
            type="textarea"
            ref="textarea"
            v-model="comment"
            show-word-limit
            :placeholder="commentPlaceholder"
            :autosize="{ minRows: 3 }"
            :maxlength="maxLength"
            @input="onCommentInput"
            @keyup.enter.native="onEnterKeyUp($event)" />
      </div>
    </div>
    <div class="tk-row actions">
      <div class="tk-row-actions-start">
        <div class="tk-submit-action-icon OwO" v-show="config.SHOW_EMOTION === 'true'" v-html="iconEmotion" v-clickoutside="closeOwo" ref="owo"></div>
        <div class="tk-submit-action-icon" v-show="config.SHOW_IMAGE === 'true'" v-html="iconImage" @click="openSelectImage"></div>
        <input class="tk-input-image" type="file" accept="image/*" value="" ref="inputFile" @change="onSelectImage" />
        <div class="tk-error-message">{{ errorMessage }}</div>
      </div>
      <a class="tk-submit-action-icon __markdown"
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
      <div class="tk-turnstile-container" ref="turnstile-container">
        <div class="tk-turnstile" ref="turnstile"></div>
      </div>
      <div class="tk-geetest-container" ref="geetest-container"></div>
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
import { marked, call, logger, renderLinks, renderMath, renderCode, initOwoEmotions, initMarkedOwo, t, getUrl, getHref, blobToDataURL, getUserAgent } from '../../utils'
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
      turnstileLoad: null,
      geeTestLoad: null,
      geeTestCaptchaObj: null,
      iconMarkdown,
      iconEmotion,
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
    },
    commentPlaceholder () {
      let ph = this.$twikoo.placeholder || this.config.COMMENT_PLACEHOLDER || ''
      ph = ph.replace(/<br>/g, '\n')
      return ph
    },
    maxLength () {
      let limitLength = parseInt(this.config.LIMIT_LENGTH)
      if (Number.isNaN(limitLength)) limitLength = 500
      return limitLength > 0 ? limitLength : null
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
        const odata = await initOwoEmotions(this.config.EMOTION_CDN || 'https://owo.imaegoo.com/owo.json')
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
    initTurnstile () {
      if (!this.config.TURNSTILE_SITE_KEY) return
      if (window.turnstile) {
        this.turnstileLoad = Promise.resolve()
        return
      }
      this.turnstileLoad = new Promise((resolve, reject) => {
        const scriptEl = document.createElement('script')
        scriptEl.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        scriptEl.onload = resolve
        scriptEl.onerror = reject
        this.$refs['turnstile-container'].appendChild(scriptEl)
      })
    },
    getTurnstileToken () {
      return new Promise((resolve, reject) => {
        this.turnstileLoad.then(() => {
          const widgetId = window.turnstile.render(this.$refs.turnstile, {
            sitekey: this.config.TURNSTILE_SITE_KEY,
            callback: (token) => {
              resolve(token)
              setTimeout(() => {
                window.turnstile.remove(widgetId)
              }, 5000)
            },
            'error-callback': reject
          })
        })
      })
    },
    initGeeTest () {
      if (!this.config.GEETEST_CAPTCHA_ID) return
      if (window.initGeetest4) {
        this.geeTestLoad = Promise.resolve()
        return
      }
      this.geeTestLoad = new Promise((resolve, reject) => {
        const scriptEl = document.createElement('script')
        scriptEl.src = 'https://static.geetest.com/v4/gt4.js'
        scriptEl.onload = resolve
        scriptEl.onerror = reject
        this.$refs['geetest-container'].appendChild(scriptEl)
      })
    },
    getGeeTestToken () {
      return new Promise((resolve, reject) => {
        this.geeTestLoad.then(() => {
          window.initGeetest4({
            captchaId: this.config.GEETEST_CAPTCHA_ID,
            product: 'bind',
            language: 'zho'
          }, (captcha) => {
            this.geeTestCaptchaObj = captcha
            captcha.onReady(() => {
              captcha.showCaptcha()
            }).onSuccess(() => {
              const result = captcha.getValidate()
              resolve({
                geeTestLotNumber: result.lot_number,
                geeTestCaptchaOutput: result.captcha_output,
                geeTestPassToken: result.pass_token,
                geeTestGenTime: result.gen_time
              })
            }).onError((e) => {
              reject(e)
            })
          })
        })
      })
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
            renderCode(this.$refs['comment-preview'], this.config.HIGHLIGHT_THEME, this.config.HIGHLIGHT_PLUGIN)
          }
        })
      }
    },
    async send () {
      this.isSending = true
      try {
        if (this.comment.match(new RegExp(`!\\[${t('IMAGE_UPLOAD_PLACEHOLDER')}.+\\]\\(\\)`))) {
          throw new Error(t('IMAGE_UPLOAD_PLEASE_WAIT'))
        }
        const comment = {
          nick: this.nick,
          mail: this.mail,
          link: this.link,
          ua: await getUserAgent(),
          url: getUrl(this.$twikoo.path),
          href: getHref(this.$twikoo.href),
          comment: marked(this.comment),
          pid: this.pid ? this.pid : this.replyId,
          rid: this.replyId
        }
        if (this.config.GEETEST_CAPTCHA_ID) {
          const geeTestResult = await this.getGeeTestToken()
          comment.geeTestLotNumber = geeTestResult.geeTestLotNumber
          comment.geeTestCaptchaOutput = geeTestResult.geeTestCaptchaOutput
          comment.geeTestPassToken = geeTestResult.geeTestPassToken
          comment.geeTestGenTime = geeTestResult.geeTestGenTime
        } else if (this.config.TURNSTILE_SITE_KEY) {
          comment.turnstileToken = await this.getTurnstileToken()
        }
        const sendResult = await call(this.$tcb, 'COMMENT_SUBMIT', comment)
        if (sendResult && sendResult.result && sendResult.result.id) {
          this.comment = ''
          this.errorMessage = ''
          this.$emit('load')
          this.saveDraft()
        } else {
          throw new Error(sendResult.result.message)
        }
      } catch (e) {
        logger.error('评论失败', e)
        this.errorMessage = `${t('COMMENT_FAILED')}: ${e && e.message}`
      } finally {
        this.isSending = false
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
    async parseAndUploadPhoto (photo) {
      if (!photo || this.config.SHOW_IMAGE !== 'true') return
      const nameSplit = photo.name.split('.')
      const fileType = nameSplit.length > 1 ? nameSplit.pop() : ''
      if (imageTypes.indexOf(fileType.toLowerCase()) === -1) return
      const userId = this.getUserId()
      const fileIndex = `${Date.now()}-${userId}`
      const fileName = nameSplit.join('.')
      const isGif = photo.type === 'image/gif'
      const newFileName = isGif ? fileName : fileName + '.webp'
      const newFileType = isGif ? fileType : 'webp'
      this.paste(this.getImagePlaceholder(fileIndex, newFileType))
      const imageCdn = this.config.IMAGE_CDN
      const compressedPhoto = await this.compressImage(photo)
      if (this.$tcb && (!imageCdn || imageCdn === 'qcloud')) {
        this.uploadPhotoToQcloud(fileIndex, newFileName, newFileType, compressedPhoto)
      } else if (imageCdn) {
        this.uploadPhotoToThirdParty(fileIndex, newFileName, newFileType, compressedPhoto)
      } else {
        this.uploadFailed(fileIndex, newFileType, t('IMAGE_UPLOAD_FAILED_NO_CONF'))
      }
    },
    getUserId () {
      if (this.$tcb) {
        return this.$tcb.auth.currentUser.uid
      } else {
        return localStorage.getItem('twikoo-access-token')
      }
    },
    async compressImage (photo) {
      if (photo.type === 'image/gif') {
        return photo
      }
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height
            const maxSize = 1920
            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = (height * maxSize) / width
                width = maxSize
              } else {
                width = (width * maxSize) / height
                height = maxSize
              }
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            const webpType = 'image/webp'
            const fileName = photo.name.replace(/\.[^.]+$/, '.webp')
            canvas.toBlob((blob) => {
              resolve(new File([blob], fileName, { type: webpType }))
            }, webpType, 0.85)
          }
          img.src = e.target.result
        }
        reader.readAsDataURL(photo)
      })
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
          this.uploadCompleted(fileIndex, fileName, fileType, tempFileUrl)
        }
      } catch (e) {
        console.error(e)
        this.uploadFailed(fileIndex, fileType, e.message)
      }
    },
    async uploadPhotoToThirdParty (fileIndex, fileName, fileType, photo) {
      try {
        const { result: uploadResult } = await call(this.$tcb, 'UPLOAD_IMAGE', {
          fileName: fileName,
          photo: await blobToDataURL(photo)
        })
        if (uploadResult.data) {
          this.uploadCompleted(fileIndex, fileName, fileType, uploadResult.data.url)
        } else if (uploadResult.code === 1041) {
          this.uploadFailed(fileIndex, fileType, t('IMAGE_UPLOAD_NSFW'))
        } else {
          console.error(uploadResult)
          this.uploadFailed(fileIndex, fileType, uploadResult.err)
        }
      } catch (e) {
        console.error(e)
        this.uploadFailed(fileIndex, fileType, e.message)
      }
    },
    uploadCompleted (fileIndex, fileName, fileType, fileUrl) {
      fileName = fileName.replace(/[[\]]/g, '_')
      this.comment = this.comment.replace(this.getImagePlaceholder(fileIndex, fileType), `![${fileName}](${fileUrl})`)
      this.$refs.inputFile.value = ''
    },
    uploadFailed (fileIndex, fileType, reason) {
      this.comment = this.comment.replace(this.getImagePlaceholder(fileIndex, fileType), `_${t('IMAGE_UPLOAD_FAILED')}: ${reason}_`)
      this.$refs.inputFile.value = ''
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
      return `![${t('IMAGE_UPLOAD_PLACEHOLDER')} ${fileIndex}.${fileType}]()`
    }
  },
  mounted () {
    if (this.pid) {
      this.$refs['tk-submit'].scrollIntoView({
        behavior: 'instant',
        block: 'center'
      })
    }
    this.initDraft()
    this.initOwo()
    this.addEventListener()
    this.onBgImgChange()
    this.initTurnstile()
    this.initGeeTest()
  },
  watch: {
    'config.SHOW_EMOTION': function () {
      this.initOwo()
    },
    'config.COMMENT_BG_IMG': function () {
      this.onBgImgChange()
    },
    'config.TURNSTILE_SITE_KEY': function () {
      this.initTurnstile()
    },
    'config.GEETEST_CAPTCHA_ID': function () {
      this.initGeeTest()
    }
  }
}
</script>

<style>
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
.tk-submit-action-icon {
  align-self: center;
  display: inline-block;
  width: 1.25em;
  line-height: 0;
  margin-right: 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.tk-submit-action-icon svg:hover {
  opacity: 0.8;
}
.tk-submit-action-icon.__markdown {
  color: #909399;
}
.tk-error-message {
  word-break: break-all;
  color: #ff0000;
  font-size: 0.75em;
  flex-shrink: 1;
}
.tk-input-image {
  display: none;
}
.tk-input {
  flex: 1;
}
.tk-input .el-textarea__inner {
  background-position: right bottom;
  background-repeat: no-repeat;
}
.tk-turnstile-container {
  position: absolute;
  right: 0;
  bottom: -75px;
  z-index: 1;
}
.tk-turnstile {
  display: flex;
  flex-direction: column;
}
.tk-geetest-container {
  position: absolute;
  right: 0;
  bottom: -75px;
  z-index: 1;
}
.tk-preview-container {
  margin-left: 3rem;
  margin-bottom: 1rem;
  padding: 5px 15px;
  border: 1px solid rgba(128,128,128,0.31);
  border-radius: 4px;
  word-break: break-word;
}
.tk-fade-in {
  animation: tkFadeIn .3s;
}
@keyframes tkFadeIn {
  0% {
    opacity: 0
  }

  to {
    opacity: 1
  }
}
</style>

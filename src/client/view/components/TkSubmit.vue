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
        <div class="tk-voice-container" v-show="config.SHOW_VOICE === 'true'">
          <div class="tk-submit-action-icon tk-voice-icon" v-html="isRecording ? iconVoiceRecording : iconVoice" @click="toggleRecording"></div>
          <div class="tk-voice-status" v-if="isRecording">{{ recordingStatusText }}</div>
          <div class="tk-voice-status" v-if="showConfirmUpload">
            <el-button size="mini" type="primary" @click="confirmUploadVoice">确认上传</el-button>
            <el-button size="mini" @click="cancelUploadVoice">取消</el-button>
          </div>
        </div>
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
    </div>
    <div class="tk-preview-container" v-if="isPreviewing" v-html="commentHtml" ref="comment-preview"></div>
  </div>
</template>

<script>
import iconMarkdown from '@fortawesome/fontawesome-free/svgs/brands/markdown.svg'
import iconEmotion from '@fortawesome/fontawesome-free/svgs/regular/laugh.svg'
import iconImage from '@fortawesome/fontawesome-free/svgs/regular/image.svg'
import iconVoice from '@fortawesome/fontawesome-free/svgs/solid/microphone.svg'
import iconVoiceStop from '@fortawesome/fontawesome-free/svgs/solid/microphone-slash.svg'
import iconVoiceRecording from '@fortawesome/fontawesome-free/svgs/solid/microphone-alt.svg'
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
      iconMarkdown,
      iconEmotion,
      iconImage,
      iconVoice,
      iconVoiceStop,
      iconVoiceRecording,
      isRecording: false,
      mediaRecorder: null,
      audioChunks: [],
      recordingTimer: null,
      recordingTime: 0,
      recordingStatusText: '',
      recordedAudioBlob: null, // 新增：存储录音的Blob数据
      showConfirmUpload: false, // 新增：是否显示确认上传按钮
      recordedTimeString: '' // 新增：记录录音时间字符串
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
        if (this.config.TURNSTILE_SITE_KEY) {
          comment.turnstileToken = await this.getTurnstileToken()
        }
        const sendResult = await call(this.$tcb, 'COMMENT_SUBMIT', comment)
        if (sendResult && sendResult.result && sendResult.result.id) {
          // 保存删除令牌到localStorage
          if (sendResult.result.deleteToken) {
            console.log('评论提交成功，保存删除令牌:', {
              commentId: sendResult.result.id,
              deleteToken: sendResult.result.deleteToken
            })
            const deleteTokens = JSON.parse(localStorage.getItem('twikoo-delete-tokens') || '{}')
            deleteTokens[sendResult.result.id] = sendResult.result.deleteToken
            localStorage.setItem('twikoo-delete-tokens', JSON.stringify(deleteTokens))
            console.log('删除令牌已保存到localStorage:', JSON.parse(localStorage.getItem('twikoo-delete-tokens')))
          } else {
            console.warn('评论提交成功，但没有收到删除令牌')
          }

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
    parseAndUploadPhoto (photo) {
      if (!photo || this.config.SHOW_IMAGE !== 'true') return
      const nameSplit = photo.name.split('.')
      const fileType = nameSplit.length > 1 ? nameSplit.pop() : ''
      if (imageTypes.indexOf(fileType.toLowerCase()) === -1) return
      const userId = this.getUserId()
      const fileIndex = `${Date.now()}-${userId}`
      const fileName = nameSplit.join('.')
      this.paste(this.getImagePlaceholder(fileIndex, fileType))
      const imageCdn = this.config.IMAGE_CDN
      if (this.$tcb && (!imageCdn || imageCdn === 'qcloud')) {
        this.uploadPhotoToQcloud(fileIndex, fileName, fileType, photo)
      } else if (imageCdn) {
        this.uploadPhotoToThirdParty(fileIndex, fileName, fileType, photo)
      } else {
        this.uploadFailed(fileIndex, fileType, t('IMAGE_UPLOAD_FAILED_NO_CONF'))
      }
    },
    getUserId () {
      if (this.$tcb) {
        return this.$tcb.auth.currentUser.uid
      } else {
        return localStorage.getItem('twikoo-access-token')
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
          this.uploadCompleted(fileIndex, fileName, fileType, tempFileUrl)
        }
      } catch (e) {
        console.error(e)
        this.uploadFailed(fileIndex, fileType, e.message)
      }
    },
    async uploadPhotoToThirdParty (fileIndex, fileName, fileType, photo) {
      try {
        let smmsImageDuplicateCheck
        const { result: uploadResult } = await call(this.$tcb, 'UPLOAD_IMAGE', {
          fileName: `${fileIndex}.${fileType}`,
          photo: await blobToDataURL(photo)
        })
        if (uploadResult.data) {
          this.uploadCompleted(fileIndex, fileName, fileType, uploadResult.data.url)
        } else if (uploadResult.code === 1040 && uploadResult.err &&
          (smmsImageDuplicateCheck = uploadResult.err.match(/this image exists at: (http[^ ]+)/))) {
          console.warn(uploadResult)
          this.uploadCompleted(fileIndex, fileName, fileType, smmsImageDuplicateCheck[1])
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
    },
    async toggleRecording () {
      if (this.isRecording) {
        this.stopRecording()
      } else {
        await this.startRecording()
      }
    },
    async startRecording () {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.mediaRecorder = new MediaRecorder(stream)
        this.audioChunks = []

        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data)
        }

        this.mediaRecorder.onstop = () => {
          this.recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/wav' })
          this.recordedTimeString = this.generateTimeString()
          stream.getTracks().forEach(track => track.stop())
        }

        this.mediaRecorder.start()
        this.isRecording = true
        this.recordingTime = 0
        this.recordingStatusText = '录音中...'

        // 开始计时
        this.recordingTimer = setInterval(() => {
          this.recordingTime++
          this.recordingStatusText = `录音中... ${this.recordingTime}秒`
          // 限制录音时长为60秒
          if (this.recordingTime >= 60) {
            this.errorMessage = t('VOICE_RECORD_TOO_LONG')
            this.stopRecording()
          }
        }, 1000)
      } catch (error) {
        console.error('无法访问麦克风:', error)
        this.errorMessage = `${t('VOICE_MIC_PERMISSION_DENIED')}: ${error.message}`
      }
    },
    // 修改 stopRecording 方法
    stopRecording () {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop()
      }
      this.isRecording = false

      // 停止计时
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }

      // 不再立即上传，而是显示确认按钮
      this.recordingStatusText = '录音完成，点击确认上传'
      this.showConfirmUpload = true
    },
    // 新增：确认上传语音
    confirmUploadVoice () {
      if (this.recordedAudioBlob) {
        this.uploadVoice(this.recordedAudioBlob)
        this.showConfirmUpload = false
        this.recordedAudioBlob = null
        this.recordedTimeString = ''
      }
    },
    // 新增：取消上传语音
    cancelUploadVoice () {
      this.showConfirmUpload = false
      this.recordedAudioBlob = null
      this.recordedTimeString = ''
      this.recordingStatusText = ''
    },
    // 新增：生成时间字符串方法
    generateTimeString () {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const day = now.getDate()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const seconds = now.getSeconds().toString().padStart(2, '0')
      return `${year}年${month}月${day}日${hours}:${minutes}:${seconds}`
    },
    // 修改 uploadVoice 方法，使用预先生成的时间字符串
    async uploadVoice (audioBlob) {
      try {
        const timeString = this.recordedTimeString || this.generateTimeString()
        const pathPrefix = this.config.VOICE_CDN_PATH || 'twikoo'
        const fileName = `${pathPrefix}/${timeString}.wav`

        // 在评论框中插入语音占位符
        this.paste(this.getVoicePlaceholder(timeString))

        // 上传语音文件逻辑保持不变
        if (this.$tcb && this.config.VOICE_CDN === 'qcloud') {
          await this.uploadVoiceToQcloud(timeString, fileName, audioBlob)
        } else if (this.config.VOICE_CDN) {
          await this.uploadVoiceToThirdParty(timeString, fileName, audioBlob)
        } else {
          this.voiceUploadFailed(timeString, t('VOICE_UPLOAD_FAILED_NO_CONF'))
        }
      } catch (error) {
        console.error('语音上传失败:', error)
        this.errorMessage = `${t('VOICE_UPLOAD_FAILED')}: ${error.message}`
      }
    },
    async uploadVoiceToQcloud (fileIndex, fileName, audioBlob) {
      try {
        const { result: uploadResult } = await call(this.$tcb, 'UPLOAD_VOICE', {
          fileName: fileName,
          voice: await blobToDataURL(audioBlob),
          config: {
            VOICE_CDN: this.config.VOICE_CDN,
            VOICE_CDN_TOKEN: this.config.VOICE_CDN_TOKEN,
            VOICE_CDN_SECRET: this.config.VOICE_CDN_SECRET,
            VOICE_CDN_DOMAIN: this.config.VOICE_CDN_DOMAIN,
            VOICE_CDN_REGION: this.config.VOICE_CDN_REGION,
            VOICE_CDN_BUCKET: this.config.VOICE_CDN_BUCKET,
            VOICE_CDN_PATH: this.config.VOICE_CDN_PATH
          }
        })
        if (uploadResult.data) {
          this.voiceUploadCompleted(fileIndex, fileName, uploadResult.data.url)
        } else {
          console.error(uploadResult)
          this.voiceUploadFailed(fileIndex, uploadResult.err)
        }
      } catch (e) {
        console.error(e)
        this.voiceUploadFailed(fileIndex, e.message)
      }
    },
    async uploadVoiceToThirdParty (fileIndex, fileName, audioBlob) {
      try {
        const { result: uploadResult } = await call(this.$tcb, 'UPLOAD_VOICE', {
          fileName: fileName,
          voice: await blobToDataURL(audioBlob),
          config: {
            VOICE_CDN: this.config.VOICE_CDN,
            VOICE_CDN_TOKEN: this.config.VOICE_CDN_TOKEN,
            VOICE_CDN_SECRET: this.config.VOICE_CDN_SECRET,
            VOICE_CDN_DOMAIN: this.config.VOICE_CDN_DOMAIN,
            VOICE_CDN_REGION: this.config.VOICE_CDN_REGION,
            VOICE_CDN_BUCKET: this.config.VOICE_CDN_BUCKET,
            VOICE_CDN_PATH: this.config.VOICE_CDN_PATH
          }
        })
        if (uploadResult.data) {
          this.voiceUploadCompleted(fileIndex, fileName, uploadResult.data.url)
        } else {
          console.error(uploadResult)
          this.voiceUploadFailed(fileIndex, uploadResult.err)
        }
      } catch (e) {
        console.error(e)
        this.voiceUploadFailed(fileIndex, e.message)
      }
    },
    voiceUploadCompleted (fileIndex, fileName, fileUrl) {
      this.comment = this.comment.replace(this.getVoicePlaceholder(fileIndex), `<audio controls src="${fileUrl}" style="max-width: 100%;"></audio>`)
    },
    voiceUploadFailed (fileIndex, reason) {
      this.comment = this.comment.replace(this.getVoicePlaceholder(fileIndex), `_${t('VOICE_UPLOAD_FAILED')}: ${reason}_`)
    },
    getVoicePlaceholder (fileIndex) {
      return `[${t('VOICE_UPLOAD_PLACEHOLDER')} ${fileIndex}]()`
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
.tk-voice-icon {
  width: 0.875em; /* 缩小30%，1.25em * 0.7 = 0.875em */
}
.tk-voice-container {
  display: flex;
  align-items: center;
}
.tk-voice-status {
  font-size: 0.8em;
  color: #409EFF;
  margin-left: 5px;
  animation: tkPulse 1.5s infinite;
}
@keyframes tkPulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
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

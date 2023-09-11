<template>
  <div class="tk-meta-input">
    <el-input v-for="metaInput in displayedInputs"
        :key="metaInput.key"
        :name="metaInput.name"
        :type="metaInput.type"
        :placeholder="requiredFields[metaInput.key] ? t('META_INPUT_REQUIRED') : t('META_INPUT_NOT_REQUIRED')"
        v-model="metaData[metaInput.key]"
        size="small"
        @change="onMetaChange">
      <template slot="prepend">{{ metaInput.locale }}</template>
    </el-input>
  </div>
</template>

<script>
import { app } from '../index'
import { isQQ, t } from '../../utils'

// 邮箱正则表达式来自 https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email#validation
const mailRegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export default {
  props: {
    nick: String,
    mail: String,
    link: String,
    config: Object
  },
  data () {
    return {
      metaInputs: [
        { key: 'nick', locale: t('META_INPUT_NICK'), name: 'nick', type: 'text' },
        { key: 'mail', locale: t('META_INPUT_MAIL'), name: 'mail', type: 'email' },
        { key: 'link', locale: t('META_INPUT_LINK'), name: 'link', type: 'text' }
      ],
      metaData: {
        nick: '',
        mail: '',
        link: ''
      }
    }
  },
  computed: {
    displayedFields () {
      const displayedFieldsSetting = this.config.DISPLAYED_FIELDS
      return {
        nick: displayedFieldsSetting ? displayedFieldsSetting.indexOf('nick') !== -1 : true,
        mail: displayedFieldsSetting ? displayedFieldsSetting.indexOf('mail') !== -1 : true,
        link: displayedFieldsSetting ? displayedFieldsSetting.indexOf('link') !== -1 : true
      }
    },
    displayedInputs () {
      return this.metaInputs.filter((i) => !!this.displayedFields[i.key])
    },
    requiredFields () {
      const requiredFieldsSetting = this.config.REQUIRED_FIELDS
      return {
        nick: requiredFieldsSetting ? requiredFieldsSetting.indexOf('nick') !== -1 : true,
        mail: requiredFieldsSetting ? requiredFieldsSetting.indexOf('mail') !== -1 : true,
        link: requiredFieldsSetting ? requiredFieldsSetting.indexOf('link') !== -1 : false
      }
    }
  },
  methods: {
    t,
    initMeta () {
      const mStr = localStorage.getItem('twikoo')
      if (mStr) {
        const metaData = JSON.parse(mStr)
        this.metaData.nick = metaData.nick
        this.metaData.mail = metaData.mail
        this.metaData.link = metaData.link
      }
      this.updateMeta()
    },
    updateMeta () {
      localStorage.setItem('twikoo', JSON.stringify(this.metaData))
      this.$emit('update', {
        meta: this.metaData,
        valid: this.checkValid()
      })
    },
    checkValid () {
      const isValidMail = mailRegExp.test(this.metaData.mail)
      return (
        (this.metaData.nick || !this.requiredFields.nick) &&
        (isValidMail || !this.requiredFields.mail) &&
        (this.metaData.link || !this.requiredFields.link)
      )
    },
    checkQQ () {
      if (isQQ(this.metaData.nick)) {
        // 模仿 Valine 的操作逻辑，当用户在 [昵称] 输入 QQ 号时
        // 1. 自动填充数字 QQ 邮箱到 [邮箱]
        // 2. 自动填充 QQ 昵称到 [昵称]
        // 3. 自动显示 QQ 头像
        const qqNum = this.metaData.nick.replace(/@qq.com/ig, '')
        const qqMail = `${qqNum}@qq.com`
        this.metaData.mail = qqMail
        this.getQQNick(qqNum)
      }
    },
    getQQNick (qqNum) {
      const url = `https://api.qjqq.cn/api/qqinfo?qq=${qqNum}`
      const xhr = new XMLHttpRequest()
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          this.metaData.nick = response.name
          this.updateMeta()
        }
      }
      xhr.open('GET', url)
      xhr.send()
    },
    checkAdminCrypt () {
      const app = this.$root.$children[0]
      const showAdminEntry = this.config.HIDE_ADMIN_CRYPT
        ? this.config.HIDE_ADMIN_CRYPT === this.metaData.nick
        : true
      app.onShowAdminEntry(showAdminEntry)
    },
    onMetaChange () {
      this.checkQQ()
      this.updateMeta()
      this.checkAdminCrypt()
    }
  },
  watch: {
    nick (newVal) { this.metaData.nick = newVal },
    mail (newVal) { this.metaData.mail = newVal },
    link (newVal) { this.metaData.link = newVal },
    requiredFields: {
      handler (val, oldVal) {
        this.$emit('update', {
          meta: this.metaData,
          valid: this.checkValid()
        })
      },
      deep: true
    },
    'config.VERSION' () {
      this.checkAdminCrypt()
    }
  },
  mounted () {
    app.$on('initMeta', this.initMeta)
    this.initMeta()
  }
}
</script>

<style>
.tk-meta-input {
  display: flex;
}
.tk-meta-input .el-input {
  width: auto;
  width: calc((100% - 1rem) / 3); /* Fix Safari */
  flex: 1;
}
.tk-meta-input .el-input + .el-input {
  margin-left: 0.5rem;
}
.tk-meta-input .el-input .el-input-group__prepend {
  padding: 0 1rem;
}
.tk-meta-input .el-input input:invalid {
  border: 1px solid #f56c6c;
  box-shadow: none;
}
@media screen and (max-width: 767px) {
  .tk-meta-input {
    flex-direction: column;
  }
  .tk-meta-input .el-input {
    width: auto;
  }
  .tk-meta-input .el-input + .el-input {
    margin-left: 0;
    margin-top: 0.5rem;
  }
}
</style>

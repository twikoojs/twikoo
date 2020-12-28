<template>
  <div class="tk-meta-input">
    <el-input v-for="metaInput in metaInputs"
        :key="metaInput.key"
        :name="metaInput.name"
        :placeholder="requiredFields[metaInput.key] ? '必填' : '选填'"
        v-model="metaData[metaInput.key]"
        type="text"
        size="small"
        @change="onMetaChange">
      <template slot="prepend">{{ metaInput.locale }}</template>
    </el-input>
  </div>
</template>

<script>
import { isQQ } from '../../js/utils'

const metaInputs = [
  { key: 'nick', locale: '昵称', name: 'nick' },
  { key: 'mail', locale: '邮箱', name: 'mail' },
  { key: 'link', locale: '网址', name: 'link' }
]

export default {
  props: {
    nick: String,
    mail: String,
    link: String,
    config: Object
  },
  data () {
    return {
      metaInputs,
      metaData: {
        nick: '',
        mail: '',
        link: ''
      }
    }
  },
  computed: {
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
    initMeta () {
      if (localStorage.getItem('twikoo')) {
        const metaData = JSON.parse(localStorage.getItem('twikoo'))
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
      return (
        (this.metaData.nick || !this.requiredFields.nick) &&
        (this.metaData.mail || !this.requiredFields.mail) &&
        (this.metaData.link || !this.requiredFields.link)
      )
    },
    checkQQ () {
      if (isQQ(this.metaData.nick)) {
        // 模仿 Valine 的操作逻辑，当用户在 [昵称] 输入 QQ 号时
        // 1. 自动填充数字 QQ 邮箱到 [邮箱]
        // 2. 自动填充 QQ 昵称到 [昵称] (使用了 https://docs.tenapi.cn/ 提供的接口，感谢作者：I Am I)
        // 3. 自动显示 QQ 头像
        const qqNum = this.metaData.nick.replace(/@qq.com/g, '')
        const qqMail = `${qqNum}@qq.com`
        this.metaData.mail = qqMail
        this.getQQNick(qqNum)
      }
    },
    getQQNick (qqNum) {
      const url = `https://tenapi.cn/qqname?qq=${qqNum}`
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
    this.initMeta()
  }
}
</script>

<style scoped>
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
.tk-meta-input .el-input /deep/ .el-input-group__prepend {
  padding: 0 1rem;
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

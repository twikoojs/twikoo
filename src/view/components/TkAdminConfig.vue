<template>
  <div class="tk-admin-config" v-loading="loading">
    <div class="tk-admin-config-groups">
      <div class="tk-admin-config-group" v-for="settingGroup in settings" :key="settingGroup.name">
        <div class="tk-admin-config-group-title">{{ settingGroup.name }}</div>
        <div class="tk-admin-config-item" v-for="setting in settingGroup.items" :key="setting.key">
          <div class="tk-admin-config-title">{{ setting.key }}</div>
          <div class="tk-admin-config-input">
            <el-input v-model="setting.value" :placeholder="setting.ph" size="small" :show-password="setting.secret" />
          </div>
          <div></div>
          <div class="tk-admin-config-desc">{{ setting.desc }}</div>
        </div>
      </div>
    </div>
    <div class="tk-admin-config-actions">
      <el-button size="small" type="primary" @click="saveConfig">保存</el-button>
      <el-button size="small" type="info" @click="resetConfig">重置</el-button>
    </div>
  </div>
</template>

<script>
import { call, logger } from '../../js/utils'

export default {
  data () {
    return {
      loading: true,
      settings: [
        {
          name: '通用',
          items: [
            { key: 'SITE_NAME', desc: '网站名称', ph: '示例：虹墨空间站', value: '' },
            { key: 'SITE_URL', desc: '网站地址', ph: '示例：https://www.imaegoo.com', value: '' },
            { key: 'BLOGGER_EMAIL', desc: '博主的邮箱地址，用于邮件通知、博主标识。', ph: '示例：12345@qq.com', value: '' },
            { key: 'COMMENT_PAGE_SIZE', desc: '评论列表分页大小，默认为 8。', ph: '示例：8', value: '' }
          ]
        },
        {
          name: '反垃圾',
          items: [
            { key: 'AKISMET_KEY', desc: 'Akismet 反垃圾评论，用于垃圾评论检测，设为 "MANUAL_REVIEW" 开启人工审核，留空不使用反垃圾。注册：https://akismet.com', ph: '示例：8651783edxxx', value: '' }
          ]
        },
        {
          name: '微信通知',
          items: [
            { key: 'SC_SENDKEY', desc: 'Server酱（sc.ftqq.com）微信推送的 SCKEY', ph: '示例：SCT1364TKdsiGjGvyAZNYDVnuHW12345', value: '' }
          ]
        },
        {
          name: '邮件通知',
          items: [
            { key: 'SENDER_EMAIL', desc: '邮件通知邮箱地址。对于大多数邮箱服务商，SENDER_EMAIL 必须和 SMTP_USER 保持一致，否则无法发送邮件。', ph: '示例：blog@imaegoo.com', value: '' },
            { key: 'SENDER_NAME', desc: '邮件通知标题。', ph: '示例：虹墨空间站评论提醒', value: '' },
            { key: 'SMTP_SERVICE', desc: '邮件通知邮箱服务商。支持："126", "163", "1und1", "AOL", "DebugMail", "DynectEmail", "FastMail", "GandiMail", "Gmail", "Godaddy", "GodaddyAsia", "GodaddyEurope", "Hotmail", "Mail.ru", "Maildev", "Mailgun", "Mailjet", "Mailosaur", "Mandrill", "Naver", "OpenMailBox", "Outlook365", "Postmark", "QQ", "QQex", "SES", "SES-EU-WEST-1", "SES-US-EAST-1", "SES-US-WEST-2", "SendCloud", "SendGrid", "SendPulse", "SendinBlue", "Sparkpost", "Yahoo", "Yandex", "Zoho", "hot.ee", "iCloud", "mail.ee", "qiye.aliyun"', ph: '示例：QQ', value: '' },
            { key: 'SMTP_USER', desc: '邮件通知邮箱用户名。', ph: '示例：blog@imaegoo.com', value: '' },
            { key: 'SMTP_PASS', desc: '邮件通知邮箱密码，QQ邮箱请填写授权码。', ph: '示例：password', value: '', secret: true }
          ]
        }
      ],
      serverConfig: {}
    }
  },
  methods: {
    async readConfig () {
      this.loading = true
      const res = await call(this.$tcb, 'GET_CONFIG_FOR_ADMIN')
      if (res.result && !res.result.code) {
        this.serverConfig = res.result.config
        this.resetConfig()
      }
      this.loading = false
    },
    resetConfig () {
      for (let settingGroup of this.settings) {
        for (let setting of settingGroup.items) {
          if (this.serverConfig[setting.key]) {
            setting.value = this.serverConfig[setting.key]
          }
        }
      }
    },
    async saveConfig () {
      this.loading = true
      const config = {}
      for (let settingGroup of this.settings) {
        for (let setting of settingGroup.items) {
          const oldValue = this.serverConfig[setting.key]
          const newValue = setting.value
          if (oldValue !== newValue) {
            config[setting.key] = setting.value
          }
        }
      }
      logger.log('保存配置', config)
      await call(this.$tcb, 'SET_CONFIG', { config })
      await this.readConfig()
      this.loading = false
    }
  },
  mounted () {
    this.readConfig()
  }
}
</script>

<style scoped>
.tk-admin-config-groups {
  overflow-y: auto;
  padding-right: 0.5em;
}
.tk-admin-config-groups::-webkit-scrollbar {
  width: 5px;
  background-color: transparent;
}
.tk-admin-config-groups::-webkit-scrollbar-track {
  background-color: transparent;
}
.tk-admin-config-groups::-webkit-scrollbar-thumb {
  background-color: #ffffff50;
}
.tk-admin-config /deep/ .el-input__inner {
  background-color: transparent;
  color: #ffffff;
}
.tk-admin-config-group-title {
  margin-top: 1em;
  font-size: 1.25rem;
  font-weight: bold;
}
.tk-admin-config-item {
  display: grid;
  align-items: center;
  grid-template-columns: 30% 70%;
  margin-top: 1em;
}
.tk-admin-config-title {
  text-align: right;
  margin-right: 1em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tk-admin-config-desc {
  margin-top: 0.5em;
}
.tk-admin-config-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1em;
}
</style>

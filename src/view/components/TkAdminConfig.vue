<template>
  <div class="tk-admin-config" v-loading="loading">
    <div class="tk-admin-config-groups">
      <div class="tk-admin-config-group" v-for="settingGroup in settings" :key="settingGroup.name">
        <div class="tk-admin-config-group-title">{{ settingGroup.name }}</div>
        <div class="tk-admin-config-item" v-for="setting in settingGroup.items" :key="setting.key">
          <div class="tk-admin-config-title" :title="setting.key">{{ setting.key }}</div>
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
    <div class="tk-admin-config-message">{{ message }}</div>
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
            { key: 'COMMENT_PAGE_SIZE', desc: '评论列表分页大小，默认为 8。', ph: '示例：8', value: '' },
            { key: 'MASTER_TAG', desc: '博主标识自定义文字，默认为 “博主”。', ph: '示例：站长', value: '' },
            { key: 'COMMENT_BG_IMG', desc: '评论框自定义背景图片 URL 地址。', ph: '', value: '' },
            { key: 'GRAVATAR_CDN', desc: '自定义头像 CDN 地址。如：cn.gravatar.com, sdn.geekzu.org, gravatar.loli.net', ph: '示例：sdn.geekzu.org', value: '' },
            { key: 'SHOW_IMAGE', desc: '启用插入图片功能，默认为：true', ph: '示例：false', value: '' },
            { key: 'SHOW_EMOTION', desc: '启用插入表情功能，默认为：true', ph: '示例：false', value: '' },
            { key: 'EMOTION_CDN', desc: '表情 CDN，默认为：https://cdn.jsdelivr.net/gh/imaegoo/emotion/owo.json', ph: '', value: '' },
            { key: 'COMMENT_PLACEHOLDER', desc: '评论框提示信息，可用<br>换行，默认为空', ph: '示例：', value: '' },
            { key: 'REQUIRED_FIELDS', desc: '评论必填信息，设为 nick,mail,link 代表全必填，设为 none 代表全选填，默认：nick,mail', ph: '示例：nick,mail,link', value: '' }
          ]
        },
        {
          name: '反垃圾',
          items: [
            { key: 'AKISMET_KEY', desc: 'Akismet 反垃圾评论，用于垃圾评论检测，设为 "MANUAL_REVIEW" 开启人工审核，留空不使用反垃圾。注册：https://akismet.com', ph: '示例：8651783edxxx', value: '' },
            { key: 'QCLOUD_SECRET_ID', desc: '腾讯云 secret id，用于垃圾评论检测。同时设置腾讯云和 Akismet 时，只有腾讯云会生效。注册：https://twikoo.js.org/cms.html', ph: '示例：AKIDBgZDdnbTw9D4ey9qPkrkwtb2Do9EwIHw', value: '' },
            { key: 'QCLOUD_SECRET_KEY', desc: '腾讯云 secret key', ph: '示例：XrkOnvKWS7WeXbP1QZT76rPgtpWx73D7', value: '', secret: true },
            { key: 'LIMIT_PER_MINUTE', desc: '每个 IP 每 10 分钟最多发表多少条评论，默认：0（无限制）', ph: '示例：5', value: '' }
          ]
        },
        {
          name: '微信通知',
          items: [
            { key: 'SC_SENDKEY', desc: 'Server酱（sc.ftqq.com）微信推送的 SCKEY', ph: '示例：SCT1364TKdsiGjGvyAZNYDVnuHW12345', value: '' },
            { key: 'SC_MAIL_NOTIFY', desc: '是否同时通过微信和邮件 2 种方式通知博主，默认只通过微信通知博主，默认：false', ph: '示例：true', value: '' }
          ]
        },
        {
          name: '邮件通知',
          items: [
            { key: 'SENDER_EMAIL', desc: '邮件通知邮箱地址。对于大多数邮箱服务商，SENDER_EMAIL 必须和 SMTP_USER 保持一致，否则无法发送邮件。', ph: '示例：blog@imaegoo.com', value: '' },
            { key: 'SENDER_NAME', desc: '邮件通知标题。', ph: '示例：虹墨空间站评论提醒', value: '' },
            { key: 'SMTP_SERVICE', desc: '邮件通知邮箱服务商。支持："126", "163", "1und1", "AOL", "DebugMail", "DynectEmail", "FastMail", "GandiMail", "Gmail", "Godaddy", "GodaddyAsia", "GodaddyEurope", "Hotmail", "Mail.ru", "Maildev", "Mailgun", "Mailjet", "Mailosaur", "Mandrill", "Naver", "OpenMailBox", "Outlook365", "Postmark", "QQ", "QQex", "SES", "SES-EU-WEST-1", "SES-US-EAST-1", "SES-US-WEST-2", "SendCloud", "SendGrid", "SendPulse", "SendinBlue", "Sparkpost", "Yahoo", "Yandex", "Zoho", "hot.ee", "iCloud", "mail.ee", "qiye.aliyun"', ph: '示例：QQ', value: '' },
            { key: 'SMTP_HOST', desc: '自定义 SMTP 服务器地址。如您已配置 SMTP_SERVICE，此项请留空。', ph: '示例：smtp.qq.com', value: '' },
            { key: 'SMTP_PORT', desc: '自定义 SMTP 端口。如您已配置 SMTP_SERVICE，此项请留空。', ph: '示例：465', value: '' },
            { key: 'SMTP_SECURE', desc: '自定义 SMTP 是否使用TLS，请填写 true 或 false。如您已配置 SMTP_SERVICE，此项请留空。', ph: '示例：true', value: '' },
            { key: 'SMTP_USER', desc: '邮件通知邮箱用户名。', ph: '示例：blog@imaegoo.com', value: '' },
            { key: 'SMTP_PASS', desc: '邮件通知邮箱密码，QQ邮箱请填写授权码。', ph: '示例：password', value: '', secret: true },
            { key: 'MAIL_SUBJECT', desc: '自定义通知邮件主题，留空则使用默认主题。', ph: '示例：您在虹墨空间站上的评论收到了回复', value: '' },
            // eslint-disable-next-line no-template-curly-in-string
            { key: 'MAIL_TEMPLATE', desc: '自定义通知邮件模板，留空则使用默认模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}', ph: '', value: '' },
            { key: 'MAIL_SUBJECT_ADMIN', desc: '自定义博主通知邮件主题，留空则使用默认主题。', ph: '示例：虹墨空间站上有新评论了', value: '' },
            // eslint-disable-next-line no-template-curly-in-string
            { key: 'MAIL_TEMPLATE_ADMIN', desc: '自定义博主通知邮件模板，留空则使用默认模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}', ph: '', value: '' }
          ]
        }
      ],
      serverConfig: {},
      message: ''
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
      for (const settingGroup of this.settings) {
        for (const setting of settingGroup.items) {
          if (this.serverConfig[setting.key]) {
            setting.value = this.serverConfig[setting.key]
          }
        }
      }
    },
    async saveConfig () {
      this.loading = true
      this.message = '正在保存'
      const config = {}
      for (const settingGroup of this.settings) {
        for (const setting of settingGroup.items) {
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
      this.message = '保存成功'
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
  font-size: 0.75em;
}
.tk-admin-config-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1em;
}
.tk-admin-config-message {
  margin-top: 0.5em;
  text-align: center;
}
</style>

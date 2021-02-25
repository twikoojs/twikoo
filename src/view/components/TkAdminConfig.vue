<template>
  <div class="tk-admin-config" v-loading="loading">
    <div class="tk-admin-warn" v-if="clientVersion !== serverVersion">
      <span>前端版本：{{ clientVersion }}，</span>
      <span>云函数版本：{{ serverVersion }}，</span>
      <span>请参考&nbsp;<a href="https://twikoo.js.org/quick-start.html#%E7%89%88%E6%9C%AC%E6%9B%B4%E6%96%B0" target="_blank">版本更新</a>&nbsp;进行升级</span>
    </div>
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
      <el-button size="small" type="primary" @click="saveConfig">{{ t('ADMIN_CONFIG_SAVE') }}</el-button>
      <el-button size="small" type="info" @click="resetConfig">{{ t('ADMIN_CONFIG_RESET') }}</el-button>
    </div>
    <div class="tk-admin-config-message">{{ message }}</div>
  </div>
</template>

<script>
import { call, logger, t } from '../../js/utils'
import { version } from '../../../package.json'

export default {
  data () {
    return {
      loading: true,
      settings: [
        {
          name: t('ADMIN_CONFIG_CATEGORY_COMMON'),
          items: [
            { key: 'SITE_NAME', desc: t('ADMIN_CONFIG_ITEM_SITE_NAME'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}虹墨空间站`, value: '' },
            { key: 'SITE_URL', desc: t('ADMIN_CONFIG_ITEM_SITE_URL'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}https://www.imaegoo.com`, value: '' },
            { key: 'BLOGGER_EMAIL', desc: t('ADMIN_CONFIG_ITEM_BLOGGER_EMAIL'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}12345@qq.com`, value: '' },
            { key: 'COMMENT_PAGE_SIZE', desc: t('ADMIN_CONFIG_ITEM_COMMENT_PAGE_SIZE'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}8`, value: '' },
            { key: 'MASTER_TAG', desc: t('ADMIN_CONFIG_ITEM_MASTER_TAG'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}站长`, value: '' },
            { key: 'COMMENT_BG_IMG', desc: t('ADMIN_CONFIG_ITEM_COMMENT_BG_IMG'), ph: '', value: '' },
            { key: 'GRAVATAR_CDN', desc: t('ADMIN_CONFIG_ITEM_GRAVATAR_CDN'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}sdn.geekzu.org`, value: '' },
            { key: 'DEFAULT_GRAVATAR', desc: t('ADMIN_CONFIG_ITEM_DEFAULT_GRAVATAR'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}mp`, value: '' },
            { key: 'COMMENT_PLACEHOLDER', desc: t('ADMIN_CONFIG_ITEM_COMMENT_PLACEHOLDER'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}`, value: '' },
            { key: 'REQUIRED_FIELDS', desc: t('ADMIN_CONFIG_ITEM_REQUIRED_FIELDS'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}nick,mail,link`, value: '' },
            { key: 'HIDE_ADMIN_CRYPT', desc: t('ADMIN_CONFIG_ITEM_HIDE_ADMIN_CRYPT'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}admin`, value: '' }
          ]
        },
        {
          name: t('ADMIN_CONFIG_CATEGORY_PLUGIN'),
          items: [
            { key: 'SHOW_IMAGE', desc: t('ADMIN_CONFIG_ITEM_SHOW_IMAGE'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}false`, value: '' },
            { key: 'IMAGE_CDN', desc: t('ADMIN_CONFIG_ITEM_IMAGE_CDN'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}false`, value: '' },
            { key: 'SHOW_EMOTION', desc: t('ADMIN_CONFIG_ITEM_SHOW_EMOTION'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}false`, value: '' },
            { key: 'EMOTION_CDN', desc: t('ADMIN_CONFIG_ITEM_EMOTION_CDN'), ph: '', value: '' },
            { key: 'HIGHLIGHT', desc: t('ADMIN_CONFIG_ITEM_HIGHLIGHT'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}false`, value: '' },
            { key: 'HIGHLIGHT_THEME', desc: t('ADMIN_CONFIG_ITEM_HIGHLIGHT_THEME'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}tomorrow`, value: '' }
          ]
        },
        {
          name: t('ADMIN_CONFIG_CATEGORY_SPAM'),
          items: [
            { key: 'AKISMET_KEY', desc: t('ADMIN_CONFIG_ITEM_AKISMET_KEY'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}8651783edxxx`, value: '' },
            { key: 'QCLOUD_SECRET_ID', desc: t('ADMIN_CONFIG_ITEM_QCLOUD_SECRET_ID'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}AKIDBgZDdnbTw9D4ey9qPkrkwtb2Do9EwIHw`, value: '' },
            { key: 'QCLOUD_SECRET_KEY', desc: t('ADMIN_CONFIG_ITEM_QCLOUD_SECRET_KEY'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}XrkOnvKWS7WeXbP1QZT76rPgtpWx73D7`, value: '', secret: true },
            { key: 'LIMIT_PER_MINUTE', desc: t('ADMIN_CONFIG_ITEM_LIMIT_PER_MINUTE'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}5`, value: '' },
            { key: 'FORBIDDEN_WORDS', desc: t('ADMIN_CONFIG_ITEM_FORBIDDEN_WORDS'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}快递,空包`, value: '' },
            { key: 'NOTIFY_SPAM', desc: t('ADMIN_CONFIG_ITEM_NOTIFY_SPAM'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}false`, value: '' }
          ]
        },
        {
          name: t('ADMIN_CONFIG_CATEGORY_IM'),
          items: [
            { key: 'SC_SENDKEY', desc: t('ADMIN_CONFIG_ITEM_SC_SENDKEY'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}SCT1364TKdsiGjGvyAZNYDVnuHW12345`, value: '' },
            { key: 'QM_SENDKEY', desc: t('ADMIN_CONFIG_ITEM_QM_SENDKEY'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}k2ni28jkmn72tqdvqryt9827u0o9nbpok`, value: '' },
            { key: 'PUSH_PLUS_TOKEN', desc: t('ADMIN_CONFIG_ITEM_PUSH_PLUS_TOKEN'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}f8ae2b8a107a408b803896a0ec012345`, value: '' },
            { key: 'SC_MAIL_NOTIFY', desc: t('ADMIN_CONFIG_ITEM_SC_MAIL_NOTIFY'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}true`, value: '' }
          ]
        },
        {
          name: t('ADMIN_CONFIG_CATEGORY_MAIL'),
          items: [
            { key: 'SENDER_EMAIL', desc: t('ADMIN_CONFIG_ITEM_SENDER_EMAIL'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}blog@imaegoo.com`, value: '' },
            { key: 'SENDER_NAME', desc: t('ADMIN_CONFIG_ITEM_SENDER_NAME'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}虹墨空间站评论提醒`, value: '' },
            { key: 'SMTP_SERVICE', desc: t('ADMIN_CONFIG_ITEM_SMTP_SERVICE'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}QQ`, value: '' },
            { key: 'SMTP_HOST', desc: t('ADMIN_CONFIG_ITEM_SMTP_HOST'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}smtp.qq.com`, value: '' },
            { key: 'SMTP_PORT', desc: t('ADMIN_CONFIG_ITEM_SMTP_PORT'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}465`, value: '' },
            { key: 'SMTP_SECURE', desc: t('ADMIN_CONFIG_ITEM_SMTP_SECURE'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}true`, value: '' },
            { key: 'SMTP_USER', desc: t('ADMIN_CONFIG_ITEM_SMTP_USER'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}blog@imaegoo.com`, value: '' },
            { key: 'SMTP_PASS', desc: t('ADMIN_CONFIG_ITEM_SMTP_PASS'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}password`, value: '', secret: true },
            { key: 'MAIL_SUBJECT', desc: t('ADMIN_CONFIG_ITEM_MAIL_SUBJECT'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}您在虹墨空间站上的评论收到了回复`, value: '' },
            // eslint-disable-next-line no-template-curly-in-string
            { key: 'MAIL_TEMPLATE', desc: t('ADMIN_CONFIG_ITEM_MAIL_TEMPLATE'), ph: '', value: '' },
            { key: 'MAIL_SUBJECT_ADMIN', desc: t('ADMIN_CONFIG_ITEM_MAIL_SUBJECT_ADMIN'), ph: `${t('ADMIN_CONFIG_EXAMPLE')}虹墨空间站上有新评论了`, value: '' },
            // eslint-disable-next-line no-template-curly-in-string
            { key: 'MAIL_TEMPLATE_ADMIN', desc: t('ADMIN_CONFIG_ITEM_MAIL_TEMPLATE_ADMIN'), ph: '', value: '' }
          ]
        }
      ],
      serverConfig: {},
      serverVersion: this.$twikoo.serverConfig.VERSION,
      clientVersion: version,
      message: ''
    }
  },
  methods: {
    t,
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

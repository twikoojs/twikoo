/**
 * 配置类
 */
class Config {
  constructor (model = {}) {
    this.SITE_NAME = model.SITE_NAME
    this.SITE_URL = model.SITE_URL
    this.SMTP_SERVICE = model.SMTP_SERVICE
    this.SMTP_USER = model.SMTP_USER
    this.SMTP_PASS = model.SMTP_PASS
    this.SC_SENDKEY = model.SC_SENDKEY
    this.SENDER_NAME = model.SENDER_NAME
    this.SENDER_EMAIL = model.SENDER_EMAIL
    this.BLOGGER_EMAIL = model.BLOGGER_EMAIL
    this.AKISMET_KEY = model.AKISMET_KEY
  }
}

export default Config

/**
 * 配置类
 */
class Config {
  constructor (model = {}) {
    this.SITE_NAME = model.SITE_NAME
    this.SITE_URL = model.SITE_URL
    this.COMMENT_PAGE_SIZE = model.COMMENT_PAGE_SIZE
    this.MASTER_TAG = model.MASTER_TAG
    this.COMMENT_BG_IMG = model.COMMENT_BG_IMG
    this.GRAVATAR_CDN = model.GRAVATAR_CDN
    this.DEFAULT_GRAVATAR = model.DEFAULT_GRAVATAR
    this.SHOW_IMAGE = model.SHOW_IMAGE
    this.IMAGE_CDN = model.IMAGE_CDN
    this.SHOW_EMOTION = model.SHOW_EMOTION
    this.EMOTION_CDN = model.EMOTION_CDN
    this.COMMENT_PLACEHOLDER = model.COMMENT_PLACEHOLDER
    this.REQUIRED_FIELDS = model.REQUIRED_FIELDS
    this.HIDE_ADMIN_CRYPT = model.HIDE_ADMIN_CRYPT
    this.HIGHLIGHT = model.HIGHLIGHT
    this.HIGHLIGHT_THEME = model.HIGHLIGHT_THEME
    this.QCLOUD_SECRET_ID = model.QCLOUD_SECRET_ID
    this.QCLOUD_SECRET_KEY = model.QCLOUD_SECRET_KEY
    this.LIMIT_PER_MINUTE = model.LIMIT_PER_MINUTE
    this.SC_MAIL_NOTIFY = model.SC_MAIL_NOTIFY
    this.SMTP_SERVICE = model.SMTP_SERVICE
    this.SMTP_HOST = model.SMTP_HOST
    this.SMTP_PORT = model.SMTP_PORT
    this.SMTP_SECURE = model.SMTP_SECURE
    this.SMTP_USER = model.SMTP_USER
    this.SMTP_PASS = model.SMTP_PASS
    this.SC_SENDKEY = model.SC_SENDKEY
    this.QM_SENDKEY = model.QM_SENDKEY
    this.SENDER_NAME = model.SENDER_NAME
    this.SENDER_EMAIL = model.SENDER_EMAIL
    this.BLOGGER_EMAIL = model.BLOGGER_EMAIL
    this.AKISMET_KEY = model.AKISMET_KEY
    this.MAIL_SUBJECT = model.MAIL_SUBJECT
    this.MAIL_TEMPLATE = model.MAIL_TEMPLATE
    this.MAIL_SUBJECT_ADMIN = model.MAIL_SUBJECT_ADMIN
    this.MAIL_TEMPLATE_ADMIN = model.MAIL_TEMPLATE_ADMIN
  }
}

export default Config

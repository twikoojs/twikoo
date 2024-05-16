const { equalsMail, getAvatar } = require('.')
const {
  getCheerio,
  getNodemailer,
  getPushoo
} = require('./lib')
const $ = getCheerio()
const pushoo = getPushoo()
const { RES_CODE } = require('./constants')
const logger = require('./logger')

let nodemailer

function lazilyGetNodemailer () {
  return nodemailer ?? (nodemailer = getNodemailer())
}

let transporter

const fn = {
  // 发送通知
  async sendNotice (comment, config, getParentComment) {
    if (comment.isSpam && config.NOTIFY_SPAM === 'false') return
    await Promise.all([
      fn.noticeMaster(comment, config),
      fn.noticeReply(comment, config, getParentComment),
      fn.noticePushoo(comment, config)
    ]).catch(err => {
      logger.error('通知异常：', err)
    })
  },
  // 初始化邮件插件
  async initMailer ({ config, throwErr = false } = {}) {
    try {
      if (!config || !config.SMTP_USER || !config.SMTP_PASS) {
        throw new Error('数据库配置不存在')
      }
      const transportConfig = {
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS
        }
      }
      if (config.SMTP_SERVICE) {
        transportConfig.service = config.SMTP_SERVICE
      } else if (config.SMTP_HOST) {
        transportConfig.host = config.SMTP_HOST
        transportConfig.port = parseInt(config.SMTP_PORT)
        transportConfig.secure = config.SMTP_SECURE === 'true'
      } else {
        throw new Error('SMTP 服务器没有配置')
      }
      transporter = lazilyGetNodemailer().createTransport(transportConfig)
      try {
        const success = await transporter.verify()
        if (success) logger.info('SMTP 邮箱配置正常')
      } catch (error) {
        throw new Error('SMTP 邮箱配置异常：' + error.message)
      }
      return true
    } catch (e) {
      if (throwErr) {
        logger.error('邮件初始化异常：', e.message)
        throw e
      } else {
        logger.warn('邮件初始化异常：', e.message)
      }
      return false
    }
  },
  // 博主通知
  async noticeMaster (comment, config) {
    if (!transporter && !await fn.initMailer({ config })) {
      logger.info('未配置邮箱或邮箱配置有误，不通知')
      return
    }
    if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
      logger.info('博主本人评论，不发送通知给博主')
      return
    }
    // 判断是否存在即时消息推送配置
    const hasIMPushConfig = config.PUSHOO_CHANNEL && config.PUSHOO_TOKEN
    if (hasIMPushConfig && config.SC_MAIL_NOTIFY !== 'true') {
      logger.info('存在即时消息推送配置，默认不发送邮件给博主，您可以在管理面板修改此行为')
      return
    }
    const SITE_NAME = config.SITE_NAME
    const NICK = comment.nick
    const IMG = getAvatar(comment, config)
    const IP = comment.ip
    const MAIL = comment.mail
    const COMMENT = comment.comment
    const SITE_URL = config.SITE_URL
    const POST_URL = fn.appendHashToUrl(comment.href || SITE_URL + comment.url, comment.id)
    const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`
    let emailContent
    if (config.MAIL_TEMPLATE_ADMIN) {
      emailContent = config.MAIL_TEMPLATE_ADMIN
        .replace(/\${SITE_URL}/g, SITE_URL)
        .replace(/\${SITE_NAME}/g, SITE_NAME)
        .replace(/\${NICK}/g, NICK)
        .replace(/\${IMG}/g, IMG)
        .replace(/\${IP}/g, IP)
        .replace(/\${MAIL}/g, MAIL)
        .replace(/\${COMMENT}/g, COMMENT)
        .replace(/\${POST_URL}/g, POST_URL)
    } else {
      emailContent = `
        <div style="border-top:2px solid #12addb;box-shadow:0 1px 3px #aaaaaa;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
          <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
            您在<a style="text-decoration:none;color: #12addb;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的文章有了新的评论
          </h2>
          <p><strong>${NICK}</strong>回复说：</p>
          <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
          <p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a><br></p>
        </div>`
    }
    let sendResult
    try {
      sendResult = await transporter.sendMail({
        from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
        to: config.BLOGGER_EMAIL || config.SENDER_EMAIL,
        subject: emailSubject,
        html: emailContent
      })
    } catch (e) {
      sendResult = e
    }
    logger.log('博主通知结果：', sendResult)
    return sendResult
  },
  // 即时消息通知
  async noticePushoo (comment, config) {
    if (!config.PUSHOO_CHANNEL || !config.PUSHOO_TOKEN) {
      logger.info('没有配置 pushoo，放弃即时消息通知')
      return
    }
    if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
      logger.info('博主本人评论，不发送通知给博主')
      return
    }
    const pushContent = fn.getIMPushContent(comment, config)
    const sendResult = await pushoo(config.PUSHOO_CHANNEL, {
      token: config.PUSHOO_TOKEN,
      title: pushContent.subject,
      content: pushContent.content,
      options: {
        bark: {
          url: pushContent.url
        }
      }
    })
    logger.info('即时消息通知结果：', sendResult)
  },
  // 即时消息推送内容获取
  getIMPushContent (comment, config) {
    const SITE_NAME = config.SITE_NAME
    const NICK = comment.nick
    const MAIL = comment.mail
    const IP = comment.ip
    const COMMENT = $(comment.comment).text()
    const SITE_URL = config.SITE_URL
    const POST_URL = fn.appendHashToUrl(comment.href || SITE_URL + comment.url, comment.id)
    const subject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}有新评论了`
    const content = `评论人：${NICK} ([${MAIL}](mailto:${MAIL}))

评论人IP：${IP}

评论内容：${COMMENT}

原文链接：[${POST_URL}](${POST_URL})`
    return {
      subject,
      content,
      url: POST_URL
    }
  },
  // 回复通知
  async noticeReply (currentComment, config, getParentComment) {
    if (!currentComment.pid) {
      logger.info('无父级评论，不通知')
      return
    }
    if (!transporter && !await fn.initMailer({ config })) {
      logger.info('未配置邮箱或邮箱配置有误，不通知')
      return
    }
    const parentComment = await getParentComment(currentComment)
    if (equalsMail(config.BLOGGER_EMAIL, parentComment.mail)) {
      logger.info('回复给博主，因为会发博主通知邮件，所以不再重复通知')
      return
    }
    if (equalsMail(currentComment.mail, parentComment.mail)) {
      logger.info('回复自己的评论，不邮件通知')
      return
    }
    const PARENT_NICK = parentComment.nick
    const IMG = getAvatar(currentComment, config)
    const PARENT_IMG = getAvatar(parentComment, config)
    const SITE_NAME = config.SITE_NAME
    const NICK = currentComment.nick
    const COMMENT = currentComment.comment
    const PARENT_COMMENT = parentComment.comment
    const POST_URL = fn.appendHashToUrl(currentComment.href || config.SITE_URL + currentComment.url, currentComment.id)
    const SITE_URL = config.SITE_URL
    const emailSubject = config.MAIL_SUBJECT || `${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复`
    let emailContent
    if (config.MAIL_TEMPLATE) {
      emailContent = config.MAIL_TEMPLATE
        .replace(/\${IMG}/g, IMG)
        .replace(/\${PARENT_IMG}/g, PARENT_IMG)
        .replace(/\${SITE_URL}/g, SITE_URL)
        .replace(/\${SITE_NAME}/g, SITE_NAME)
        .replace(/\${PARENT_NICK}/g, PARENT_NICK)
        .replace(/\${PARENT_COMMENT}/g, PARENT_COMMENT)
        .replace(/\${NICK}/g, NICK)
        .replace(/\${COMMENT}/g, COMMENT)
        .replace(/\${POST_URL}/g, POST_URL)
    } else {
      emailContent = `
        <div style="border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
          <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
            您在<a style="text-decoration:none;color: #12ADDB;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的评论有了新的回复
          </h2>
          ${PARENT_NICK} 同学，您曾发表评论：
          <div style="padding:0 12px 0 12px;margin-top:18px">
            <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${PARENT_COMMENT}</div>
            <p><strong>${NICK}</strong>回复说：</p>
            <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
            <p>
              您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a>，
              欢迎再次光临<a style="text-decoration:none; color:#12addb" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>。<br>
            </p>
          </div>
        </div>`
    }
    let sendResult
    try {
      sendResult = await transporter.sendMail({
        from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
        to: parentComment.mail,
        subject: emailSubject,
        html: emailContent
      })
    } catch (e) {
      sendResult = e
    }
    logger.log('回复通知结果：', sendResult)
    return sendResult
  },
  appendHashToUrl (url, hash) {
    if (url.indexOf('#') === -1) {
      return `${url}#${hash}`
    } else {
      return `${url.substring(0, url.indexOf('#'))}#${hash}`
    }
  },
  async emailTest (event, config, isAdminUser) {
    const res = {}
    if (isAdminUser) {
      try {
        // 邮件测试前清除 transporter，保证读取的是最新的配置
        transporter = null
        await fn.initMailer({ config, throwErr: true })
        const sendResult = await transporter.sendMail({
          from: config.SENDER_EMAIL,
          to: event.mail || config.BLOGGER_EMAIL || config.SENDER_EMAIL,
          subject: 'Twikoo 邮件通知测试邮件',
          html: '如果您收到这封邮件，说明 Twikoo 邮件功能配置正确'
        })
        res.result = sendResult
      } catch (e) {
        res.message = e.message
      }
    } else {
      res.code = RES_CODE.NEED_LOGIN
      res.message = '请先登录'
    }
    return res
  }
}

module.exports = fn

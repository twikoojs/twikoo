const nodemailer = require('nodemailer')
const tcb = require('@cloudbase/node-sdk')
const axios = require('axios')
const qs = require('querystring')
const $ = require('cheerio')
const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()

// 使用全局变量，短时间内发送多封邮件，只需初始化一次
let transporter

async function init (config) {
  try {
    if (!config || !config.SMTP_SERVICE || !config.SMTP_USER || !config.SMTP_PASS) throw new Error('数据库配置不存在')
    transporter = nodemailer.createTransport({
      service: config.SMTP_SERVICE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      }
    })
    transporter.verify(function (error, success) {
      if (error) throw new Error('SMTP 邮箱配置异常：', error)
      else if (success) console.log('SMTP 邮箱配置正常')
    })
    return true
  } catch (e) {
    console.error('邮件初始化异常：', e.message)
    return false
  }
}

/**
 * 博主通知
 */
exports.noticeMaster = async (comment, config) => {
  if (!transporter) if (!await init(config)) return
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const COMMENT = comment.comment
  const SITE_URL = config.SITE_URL
  const POST_URL = comment.href || SITE_URL + comment.url
  const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`
  const emailContent = config.MAIL_TEMPLATE_ADMIN || `
    <div style="border-top:2px solid #12addb;box-shadow:0 1px 3px #aaaaaa;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
      <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
        您在<a style="text-decoration:none;color: #12addb;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的文章有了新的评论
      </h2>
      <p><strong>${NICK}</strong>回复说：</p>
      <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
      <p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a><br></p>
    </div>`
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
  console.log('博主通知结果：', sendResult)
  return sendResult
}

/**
 * 微信通知
 */
exports.noticeWeChat = async (comment, config) => {
  if (!config.SC_SENDKEY) {
    console.log('没有配置 server 酱，放弃微信通知')
    return
  }
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const COMMENT = $(comment.comment).text()
  const SITE_URL = config.SITE_URL
  const POST_URL = comment.href || SITE_URL + comment.url
  const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`
  const emailContent = `${NICK}回复说：\n${COMMENT}\n您可以点击 ${POST_URL} 查看回复的完整內容`
  let scApiUrl = 'https://sc.ftqq.com'
  if (config.SC_SENDKEY.substring(0, 3).toLowerCase() === 'sct') {
    // 兼容 server 酱测试专版
    scApiUrl = 'https://sctapi.ftqq.com'
  }
  const sendResult = await axios.post(`${scApiUrl}/${config.SC_SENDKEY}.send`, qs.stringify({
    title: emailSubject,
    desp: emailContent
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  console.log('微信通知结果：', sendResult)
}

/**
 * 回复通知
 */
exports.noticeReply = async (currentComment, config) => {
  if (!currentComment.pid) return
  if (!transporter) if (!await init(config)) return
  let parentComment = await db
    .collection('comment')
    .where({ _id: currentComment.pid })
    .get()
  parentComment = parentComment.data[0]
  const PARENT_NICK = parentComment.nick
  const SITE_NAME = config.SITE_NAME
  const NICK = currentComment.nick
  const COMMENT = currentComment.comment
  const PARENT_COMMENT = parentComment.comment
  const POST_URL = (currentComment.href || config.SITE_URL + currentComment.url) + '#' + currentComment.objectId
  const SITE_URL = config.SITE_URL
  const emailSubject = config.MAIL_SUBJECT || `${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复`
  const emailContent = config.MAIL_TEMPLATE || `
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
  console.log('回复通知结果：', sendResult)
  return sendResult
}

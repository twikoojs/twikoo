/*!
 * Twikoo cloudbase function v0.2.3
 * (c) 2020-2020 iMaeGoo
 * Released under the MIT License.
 */

// 三方依赖 / 3rd party dependencies
const tcb = require('@cloudbase/node-sdk')
const md5 = require('blueimp-md5')
const bowser = require('bowser')
const nodemailer = require('nodemailer')
const axios = require('axios')
const qs = require('querystring')
const $ = require('cheerio')

// 云函数 SDK / tencent cloudbase sdk
const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()
const _ = db.command

// 常量 / constants
const VERSION = '0.2.3'
const RES_CODE = {
  SUCCESS: 0,
  FAIL: 1000,
  EVENT_NOT_EXIST: 1001,
  PASS_EXIST: 1010,
  CONFIG_NOT_EXIST: 1020,
  CREDENTIALS_NOT_EXIST: 1021,
  CREDENTIALS_INVALID: 1025,
  PASS_NOT_EXIST: 1022,
  PASS_NOT_MATCH: 1023,
  NEED_LOGIN: 1024
}
const ADMIN_USER_ID = 'admin'

// 全局变量 / variables
// 警告：全局定义的变量，会被云函数缓存，请慎重定义全局变量
// 参考 https://docs.cloudbase.net/cloud-function/deep-principle.html 中的 “实例复用”
let config
let transporter

// 云函数入口点 / entry point
exports.main = async (event, context) => {
  console.log('请求方法：', event.event)
  console.log('请求参数：', event)
  let res = {}
  await readConfig()
  try {
    switch (event.event) {
      case 'GET_FUNC_VERSION':
        res = getFuncVersion()
        break
      case 'COMMENT_GET':
        res = await commentGet(event)
        break
      case 'COMMENT_GET_FOR_ADMIN':
        res = await commentGetForAdmin(event)
        break
      case 'COMMENT_DELETE_FOR_ADMIN':
        res = await commentDeleteForAdmin(event)
        break
      case 'COMMENT_LIKE':
        res = await commentLike(event)
        break
      case 'COMMENT_SUBMIT':
        res = await commentSubmit(event)
        break
      case 'COUNTER_GET':
        res = await counterGet(event)
        break
      case 'GET_PASSWORD_STATUS':
        res = await getPasswordStatus()
        break
      case 'SET_PASSWORD':
        res = await setPassword(event)
        break
      case 'GET_CONFIG':
        res = await getConfig(event)
        break
      case 'GET_CONFIG_FOR_ADMIN':
        res = await getConfigForAdmin(event)
        break
      case 'SET_CONFIG':
        res = await setConfig(event)
        break
      case 'LOGIN':
        res = await login(event.password)
        break
      default:
        res.code = RES_CODE.EVENT_NOT_EXIST
        res.message = '请更新 Twikoo 云函数至最新版本'
    }
  } catch (e) {
    console.error('Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/imaegoo/twikoo/issues')
    console.error('请求参数：', event)
    console.error('错误信息：', e)
    res.code = RES_CODE.FAIL
    res.message = e.message
  }
  console.log('请求返回：', res)
  return res
}

// 获取 Twikoo 云函数版本
function getFuncVersion () {
  return {
    code: RES_CODE.SUCCESS,
    version: VERSION
  }
}

// 判断是否存在管理员密码
async function getPasswordStatus () {
  const conf = await readConfig()
  return {
    code: RES_CODE.SUCCESS,
    status: !!conf.ADMIN_PASS,
    credentials: !! conf.CREDENTIALS,
    version: VERSION
  }
}

// 写入管理密码
async function setPassword (event) {
  const conf = await readConfig()
  const isAdminUser = await isAdmin()
  // 如果数据库里没有密码，则写入密码
  // 如果数据库里有密码，则只有管理员可以写入密码
  if (conf.ADMIN_PASS && !isAdminUser) {
    return { code: RES_CODE.PASS_EXIST, message: '请先登录再修改密码' }
  }
  if (!conf.CREDENTIALS && !event.credentials) {
    return { code: RES_CODE.CREDENTIALS_NOT_EXIST, message: '未配置登录私钥' }
  }
  if (!conf.CREDENTIALS && event.credentials) {
    const checkResult = await checkAndSaveCredentials(event.credentials)
    if (!checkResult) {
      return { code: RES_CODE.CREDENTIALS_INVALID, message: '无效的私钥文件' }
    }
  }
  const ADMIN_PASS = md5(event.password)
  await writeConfig({ ADMIN_PASS })
  return {
    code: RES_CODE.SUCCESS
  }
}

async function checkAndSaveCredentials (credentials) {
  try {
    const ticket = getAdminTicket(JSON.parse(credentials))
    if (!ticket) return false
    await writeConfig({ CREDENTIALS: credentials })
    return true
  } catch (e) {
    console.error('私钥文件异常：', e)
    return false
  }
}

// 管理员登录
async function login (password) {
  const conf = await readConfig()
  if (!conf) {
    return { code: RES_CODE.CONFIG_NOT_EXIST, message: '数据库无配置' }
  }
  if (!conf.CREDENTIALS) {
    return { code: RES_CODE.CREDENTIALS_NOT_EXIST, message: '未配置登录私钥' }
  }
  if (!conf.ADMIN_PASS) {
    return { code: RES_CODE.PASS_NOT_EXIST, message: '未配置管理密码' }
  }
  if (conf.ADMIN_PASS !== md5(password)) {
    return { code: RES_CODE.PASS_NOT_MATCH, message: '密码错误' }
  }
  return {
    code: RES_CODE.SUCCESS,
    ticket: getAdminTicket(JSON.parse(conf.CREDENTIALS))
  }
}

// 获取管理员登录 ticket
function getAdminTicket (credentials) {
  const adminApp = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV, credentials })
  const ticket = adminApp.auth().createTicket(ADMIN_USER_ID, {
    refresh: 3600 * 1000 // access_token的刷新时间
  })
  return ticket
}

// 读取评论
// TODO: 分页
async function commentGet (event) {
  const res = {}
  let uid
  try {
    validate(event, ['url'])
    uid = await auth.getEndUserInfo().userInfo.uid
    const data = await db
      .collection('comment')
      .where({
        url: event.url,
        isSpam: _.neq(true)
      })
      .orderBy('created', 'desc')
      .get()
    res.data = parseComment(data.data, uid)
  } catch (e) {
    res.data = []
    res.message = e.message
  }
  return res
}

// 筛除隐私字段，拼接回复列表
function parseComment (comments, uid) {
  const result = []
  for (const comment of comments) {
    if (!comment.rid) {
      const replies = comments
        .filter((item) => item.rid === comment._id)
        .map((item) => toCommentDto(item, uid, [], comments))
        .sort((a, b) => a.created - b.created)
      result.push(toCommentDto(comment, uid, replies))
    }
  }
  return result
}

// 将评论记录转换为前端需要的格式
function toCommentDto (comment, uid, replies = [], comments = []) {
  let displayOs = ''
  let displayBrowser = ''
  try {
    const ua = bowser.getParser(comment.ua)
    const os = ua.getOS()
    displayOs = [os.name, os.versionName ? os.versionName : os.version].join(' ')
    displayBrowser = [ua.getBrowserName(), ua.getBrowserVersion()].join(' ')
  } catch (e) {
    console.log('bowser 错误：', e)
  }
  return {
    id: comment._id,
    nick: comment.nick,
    mailMd5: comment.mailMd5 || md5(comment.mail),
    link: comment.link,
    comment: comment.comment,
    os: displayOs,
    browser: displayBrowser,
    master: comment.master,
    like: comment.like ? comment.like.length : 0,
    liked: comment.like ? comment.like.findIndex((item) => item === uid) > -1 : false,
    replies: replies,
    rid: comment.rid,
    pid: comment.pid,
    ruser: ruser(comment.pid, comments),
    created: comment.created,
    updated: comment.updated
  }
}

// 获取回复人昵称 / Get replied user nick name
function ruser (pid, comments = []) {
  const comment = comments.find((item) => item._id === pid)
  return comment ? comment.nick : null
}

// 管理员读取评论
async function commentGetForAdmin (event) {
  const res = {}
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    validate(event, ['per', 'page'])
    const collection = db
      .collection('comment')
    const count = await collection.count()
    const data = await collection
      .orderBy('created', 'desc')
      .skip(event.per * (event.page - 1))
      .limit(event.per)
      .get()
    res.code = RES_CODE.SUCCESS
    res.count = count.total
    res.data = parseCommentForAdmin(data.data)
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

function parseCommentForAdmin (comments) {
  for (const comment of comments) {
    comment.commentText = $(comment.comment).text()
  }
  return comments
}

// 管理员删除评论
async function commentDeleteForAdmin (event) {
  const res = {}
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    validate(event, ['id'])
    const data = await db
      .collection('comment')
      .doc(event.id)
      .delete()
    res.code = RES_CODE.SUCCESS
    res.deleted = data.deleted
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

// 点赞 / 取消点赞
async function commentLike (event) {
  const res = {}
  let uid
  try {
    validate(event, ['id'])
    uid = await auth.getEndUserInfo().userInfo.uid
  } catch (e) {
    res.message = e.message
    return res
  }
  res.updated = await like(event.id, uid)
  return res
}

// 点赞 / 取消点赞
async function like (id, uid) {
  const record = db
    .collection('comment')
    .where({ _id: id })
  const comment = await record.get()
  let likes = comment.data[0] && comment.data[0].like ? comment.data[0].like : []
  if (likes.findIndex((item) => item === uid) === -1) {
    // 赞
    likes.push(uid)
  } else {
    // 取消赞
    likes = likes.filter((item) => item !== uid)
  }
  const result = await record.update({ like: likes })
  return result.updated
}

/**
 * 提交评论
 * @param {String} event.nick 昵称
 * @param {String} event.mail 邮箱
 * @param {String} event.link 网址
 * @param {String} event.ua UserAgent
 * @param {String} event.url 评论页地址
 * @param {String} event.comment 评论内容
 * @param {String} event.pid 回复的 ID
 * @param {String} event.rid 评论楼 ID
 */
async function commentSubmit (event) {
  const res = {}
  try {
    validate(event, ['url', 'ua', 'comment'])
  } catch (e) {
    res.message = e.message
    return res
  }
  try {
    await readConfig()
  } catch (e) {
    await createCollections()
    await readConfig()
  }
  let comment
  try {
    comment = await save(event)
  } catch (e) {
    await createCollections()
    comment = await save(event)
  }
  res.id = comment.id
  await sendMail(comment)
  return res
}

// 保存评论
async function save (event) {
  const data = parse(event)
  const result = await db
    .collection('comment')
    .add(data)
  data.id = result.id
  return data
}

// 发送通知
async function sendMail (comment) {
  await Promise.all([
    noticeMaster(comment),
    noticeReply(comment),
    noticeWeChat(comment)
  ]).catch(console.error)
}

// 初始化邮件插件
async function initMailer () {
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

// 博主通知
async function noticeMaster (comment) {
  if (!transporter) if (!await initMailer()) return
  if (config.BLOGGER_EMAIL === comment.mail) return
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

// 微信通知
async function noticeWeChat (comment) {
  if (!config.SC_SENDKEY) {
    console.log('没有配置 server 酱，放弃微信通知')
    return
  }
  if (config.BLOGGER_EMAIL === comment.mail) return
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const COMMENT = $(comment.comment).text()
  const SITE_URL = config.SITE_URL
  const POST_URL = comment.href || SITE_URL + comment.url
  const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`
  const emailContent = `${NICK}回复说：\n${COMMENT}\n您可以点击 ${POST_URL} 查看回复的完整內容`
  let scApiUrl = 'https://sc.ftqq.com'
  let scApiParam = {
    text: emailSubject,
    desp: emailContent
  }
  if (config.SC_SENDKEY.substring(0, 3).toLowerCase() === 'sct') {
    // 兼容 server 酱测试专版
    scApiUrl = 'https://sctapi.ftqq.com'
    scApiParam = {
      title: emailSubject,
      desp: emailContent
    }
  }
  const sendResult = await axios.post(`${scApiUrl}/${config.SC_SENDKEY}.send`, qs.stringify(scApiParam), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  console.log('微信通知结果：', sendResult)
}

// 回复通知
async function noticeReply (currentComment) {
  if (!currentComment.pid) return
  if (!transporter) if (!await initMailer()) return
  let parentComment = await db
    .collection('comment')
    .where({ _id: currentComment.pid })
    .get()
  parentComment = parentComment.data[0]
  // 回复给博主，因为会发博主通知邮件，所以不再重复通知
  if (config.BLOGGER_EMAIL === parentComment.mail) return
  const PARENT_NICK = parentComment.nick
  const SITE_NAME = config.SITE_NAME
  const NICK = currentComment.nick
  const COMMENT = currentComment.comment
  const PARENT_COMMENT = parentComment.comment
  const POST_URL = (currentComment.href || config.SITE_URL + currentComment.url) + '#' + currentComment._id
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

// 将评论转为数据库存储格式
function parse (comment) {
  const timestamp = new Date().getTime()
  return {
    nick: comment.nick ? comment.nick : 'Anonymous',
    mail: comment.mail ? comment.mail : '',
    mailMd5: comment.mail ? md5(comment.mail) : '',
    link: comment.link ? comment.link : '',
    ua: comment.ua,
    ip: auth.getClientIP(),
    master: config ? comment.mail === config.BLOGGER_EMAIL : false,
    url: comment.url,
    href: comment.href,
    comment: comment.comment,
    pid: comment.pid ? comment.pid : comment.rid,
    rid: comment.rid,
    created: timestamp,
    updated: timestamp
  }
}

/**
 * 获取文章点击量
 * @param {String} event.url 文章地址
 */
async function counterGet (event) {
  const res = {}
  try {
    validate(event, ['url'])
    let record
    try {
      record = await readCounter(event.url)
    } catch (e) {
      await createCollections()
      record = await readCounter(event.url)
    }
    res.data = record.data[0] ? record.data[0] : {}
    res.time = res.data ? res.data.time : 0
    res.updated = await incCounter(event)
  } catch (e) {
    res.message = e.message
    return res
  }
  return res
}

// 读取阅读数
async function readCounter (url) {
  return await db
    .collection('counter')
    .where({ url })
    .get()
}

/**
 * 更新阅读数
 * @param {String} event.url 文章地址
 * @param {String} event.title 文章标题
 */
async function incCounter (event) {
  let result
  result = await db
    .collection('counter')
    .where({ url: event.url })
    .update({
      title: event.title,
      time: _.inc(1),
      updated: new Date().getTime()
    })
  if (result.updated === 0) {
    result = await db
      .collection('counter')
      .add({
        url: event.url,
        title: event.title,
        time: 1,
        created: new Date().getTime(),
        updated: new Date().getTime()
      })
  }
  return result.updated || result.inserted
}

async function getConfig () {
  const fullConfig = await readConfig()
  return {
    code: RES_CODE.SUCCESS,
    config: {
      SITE_NAME: fullConfig.SITE_NAME,
      SITE_URL: fullConfig.SITE_URL
    }
  }
}

async function getConfigForAdmin () {
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    const fullConfig = await readConfig()
    delete fullConfig.CREDENTIALS
    return {
      code: RES_CODE.SUCCESS,
      config: fullConfig
    }
  } else {
    return {
      code: RES_CODE.NEED_LOGIN,
      message: '请先登录'
    }
  }
}

// 修改配置
async function setConfig (event) {
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    writeConfig(event.config)
    return {
      code: RES_CODE.SUCCESS
    }
  } else {
    return {
      code: RES_CODE.NEED_LOGIN,
      message: '请先登录'
    }
  }
}

// 读取配置
async function readConfig () {
  try {
    const res = await db
      .collection('config')
      .limit(1)
      .get()
    config = res.data[0]
    return config
  } catch (e) {
    console.error('读取配置失败：', e)
    return null
  }
}

// 写入配置
async function writeConfig (newConfig) {
  console.log('写入配置：', newConfig)
  try {
    let updated
    const existConfig = await readConfig()
    if (existConfig) {
      const res = await db
        .collection('config')
        .where({}) // 不加 where 会报错 Error: param should have required property 'query'
        .limit(1)
        .update(newConfig)
      updated = res.updated
    } else {
      const res = await db
        .collection('config')
        .limit(1)
        .add(newConfig)
      updated = res.id ? 1 : 0
    }
    // 更新后重置配置缓存
    if (updated > 0) config = null
    return updated
  } catch (e) {
    console.error('写入配置失败', e)
    return null
  }
}

// 判断用户是否管理员
async function isAdmin () {
  const userInfo = await auth.getEndUserInfo()
  return ADMIN_USER_ID === userInfo.userInfo.customUserId
}

// 建立数据库 collections
async function createCollections () {
  const collections = ['comment', 'config', 'counter']
  const res = {}
  for (const collection of collections) {
    res[collection] = await db.createCollection(collection)
  }
  return res
}

// 请求参数校验
function validate (event = {}, requiredParams = []) {
  for (const requiredParam of requiredParams) {
    if (!event[requiredParam]) {
      throw new Error(`参数"${requiredParam}"不合法`)
    }
  }
}

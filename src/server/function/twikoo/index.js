/*!
 * Twikoo cloudbase function
 * (c) 2020-present iMaeGoo
 * Released under the MIT License.
 */

const { version: VERSION } = require('./package.json')
const tcb = require('@cloudbase/node-sdk') // 云开发 SDK
const {
  getCheerio,
  getDomPurify,
  getMd5,
  getSha256,
  getXml2js
} = require('./utils/lib')
const {
  getFuncVersion,
  getUrlQuery,
  getUrlsQuery,
  parseComment,
  parseCommentForAdmin,
  normalizeMail,
  equalsMail,
  getMailMd5,
  getAvatar,
  isQQ,
  addQQMailSuffix,
  getQQAvatar,
  getPasswordStatus,
  preCheckSpam,
  checkTurnstileCaptcha,
  checkGeeTestCaptcha,
  getConfig,
  getConfigForAdmin,
  validate
} = require('./utils')
const {
  jsonParse,
  commentImportValine,
  commentImportDisqus,
  commentImportArtalk,
  commentImportArtalk2,
  commentImportTwikoo
} = require('./utils/import')
const { postCheckSpam } = require('./utils/spam')
const { sendNotice, emailTest } = require('./utils/notify')
const { uploadImage } = require('./utils/image')
const logger = require('./utils/logger')

// 云函数 SDK / tencent cloudbase sdk
const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()
const _ = db.command
const $ = getCheerio()
const DOMPurify = getDomPurify()
const md5 = getMd5()
const sha256 = getSha256()
const xml2js = getXml2js()

// 常量 / constants
const { RES_CODE, MAX_REQUEST_TIMES } = require('./utils/constants')
const ADMIN_USER_ID = 'admin'

// 全局变量 / variables
// 警告：全局定义的变量，会被云函数缓存，请慎重定义全局变量
// 参考 https://docs.cloudbase.net/cloud-function/deep-principle.html 中的 “实例复用”
let config
const requestTimes = {}

// 云函数入口点 / entry point
exports.main = async (event, context) => {
  logger.log('请求 IP：', auth.getClientIP())
  logger.log('请求函数：', event.event)
  logger.log('请求参数：', event)
  let res = {}
  try {
    protect()
    await readConfig()
    switch (event.event) {
      case 'GET_FUNC_VERSION':
        res = getFuncVersion({ VERSION })
        break
      case 'COMMENT_GET':
        res = await commentGet(event)
        break
      case 'COMMENT_GET_FOR_ADMIN':
        res = await commentGetForAdmin(event)
        break
      case 'COMMENT_SET_FOR_ADMIN':
        res = await commentSetForAdmin(event)
        break
      case 'COMMENT_DELETE_FOR_ADMIN':
        res = await commentDeleteForAdmin(event)
        break
      case 'COMMENT_IMPORT_FOR_ADMIN':
        res = await commentImportForAdmin(event)
        break
      case 'COMMENT_LIKE':
        res = await commentLike(event)
        break
      case 'COMMENT_SUBMIT':
        res = await commentSubmit(event, context)
        break
      case 'POST_SUBMIT':
        res = await postSubmit(event.comment, context)
        break
      case 'COUNTER_GET':
        res = await counterGet(event)
        break
      case 'GET_PASSWORD_STATUS':
        res = await getPasswordStatus(config, VERSION)
        break
      case 'SET_PASSWORD':
        res = await setPassword(event)
        break
      case 'GET_CONFIG':
        res = getConfig({ config, VERSION, isAdmin: await isAdmin() })
        break
      case 'GET_CONFIG_FOR_ADMIN':
        res = await getConfigForAdmin({ config, isAdmin: await isAdmin() })
        break
      case 'SET_CONFIG':
        res = await setConfig(event)
        break
      case 'LOGIN':
        res = await login(event.password)
        break
      case 'GET_COMMENTS_COUNT': // >= 0.2.7
        res = await getCommentsCount(event)
        break
      case 'GET_RECENT_COMMENTS': // >= 0.2.7
        res = await getRecentComments(event)
        break
      case 'EMAIL_TEST': // >= 1.4.6
        res = await emailTest(event, config, await isAdmin())
        break
      case 'UPLOAD_IMAGE': // >= 1.5.0
        res = await uploadImage(event, config)
        break
      case 'COMMENT_EXPORT_FOR_ADMIN': // >= 1.6.13
        res = await commentExportForAdmin(event)
        break
      default:
        if (event.event) {
          res.code = RES_CODE.EVENT_NOT_EXIST
          res.message = '请更新 Twikoo 云函数至最新版本'
        } else {
          res.code = RES_CODE.SUCCESS
          res.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置'
        }
    }
  } catch (e) {
    logger.error('Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/twikoojs/twikoo/issues')
    logger.error('请求参数：', event)
    logger.error('错误信息：', e)
    res.code = RES_CODE.FAIL
    res.message = e.message
  }
  logger.log('请求返回：', res)
  return res
}

// 写入管理密码
async function setPassword (event) {
  const isAdminUser = await isAdmin()
  // 如果数据库里没有密码，则写入密码
  // 如果数据库里有密码，则只有管理员可以写入密码
  if (config.ADMIN_PASS && !isAdminUser) {
    return { code: RES_CODE.PASS_EXIST, message: '请先登录再修改密码' }
  }
  if (!config.CREDENTIALS && !event.credentials) {
    return { code: RES_CODE.CREDENTIALS_NOT_EXIST, message: '未配置登录私钥' }
  }
  if (!config.CREDENTIALS && event.credentials) {
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
    logger.error('私钥文件异常：', e)
    return false
  }
}

// 管理员登录
async function login (password) {
  if (!config) {
    return { code: RES_CODE.CONFIG_NOT_EXIST, message: '数据库无配置' }
  }
  if (!config.CREDENTIALS) {
    return { code: RES_CODE.CREDENTIALS_NOT_EXIST, message: '未配置登录私钥' }
  }
  if (!config.ADMIN_PASS) {
    return { code: RES_CODE.PASS_NOT_EXIST, message: '未配置管理密码' }
  }
  if (config.ADMIN_PASS !== md5(password)) {
    return { code: RES_CODE.PASS_NOT_MATCH, message: '密码错误' }
  }
  return {
    code: RES_CODE.SUCCESS,
    ticket: getAdminTicket(JSON.parse(config.CREDENTIALS))
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
async function commentGet (event) {
  const res = {}
  try {
    validate(event, ['url'])
    const uid = await auth.getEndUserInfo().userInfo.uid
    const isAdminUser = await isAdmin()
    const limit = parseInt(config.COMMENT_PAGE_SIZE) || 8
    const sort = event.sort || 'newest'
    let more = false
    let condition
    let query
    condition = {
      url: _.in(getUrlQuery(event.url)),
      rid: _.in(['', null])
    }
    // 查询非垃圾评论 + 自己的评论
    query = getCommentQuery({ condition, uid, isAdminUser })
    // 读取总条数
    const count = await db
      .collection('comment')
      .where(query)
      .count()
    // 读取主楼
    if (event.before) {
      condition.created = _.lt(event.before)
    }
    // 不包含置顶
    condition.top = _.neq(true)
    query = getCommentQuery({ condition, uid, isAdminUser })

    let orderField = 'created'
    let orderDirection = 'desc'
    if (sort === 'oldest') {
      orderField = 'created'
      orderDirection = 'asc'
    } else if (sort === 'popular') {
      orderField = 'ups'
      orderDirection = 'desc'
    }

    const main = await db
      .collection('comment')
      .where(query)
      .orderBy(orderField, orderDirection)
      // 流式分页，通过多读 1 条的方式，确认是否还有更多评论
      .limit(limit + 1)
      .get()
    if (main.data.length > limit) {
      // 还有更多评论
      more = true
      // 删除多读的 1 条
      main.data.splice(limit, 1)
    }
    let top = []
    if (!config.TOP_DISABLED && !event.before) {
      // 查询置顶评论
      query = {
        ...condition,
        top: true
      }
      top = await db
        .collection('comment')
        .where(query)
        .orderBy('updated', 'desc')
        .get()
      // 合并置顶评论和非置顶评论
      main.data = [
        ...top.data,
        ...main.data
      ]
    }
    condition = {
      rid: _.in(main.data.map((item) => item._id))
    }
    query = getCommentQuery({ condition, uid, isAdminUser })
    // 读取回复楼
    const reply = await db
      .collection('comment')
      .where(query)
      .get()
    res.data = parseComment([...main.data, ...reply.data], uid, config)
    res.more = more
    res.count = count.total
  } catch (e) {
    res.data = []
    res.message = e.message
  }
  return res
}

function getCommentQuery ({ condition, uid, isAdminUser }) {
  return _.or(
    { ...condition, isSpam: _.neq(isAdminUser ? 'imaegoo' : true) },
    { ...condition, uid }
  )
}

// 管理员读取评论
async function commentGetForAdmin (event) {
  const res = {}
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    validate(event, ['per', 'page'])
    const collection = db
      .collection('comment')
    const condition = getCommentSearchCondition(event)
    const count = await collection
      .where(condition)
      .count()
    const data = await collection
      .where(condition)
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

function getCommentSearchCondition (event) {
  let condition = {}
  if (event.type) {
    switch (event.type) {
      case 'VISIBLE':
        condition = { isSpam: _.neq(true) }
        break
      case 'HIDDEN':
        condition = { isSpam: true }
        break
    }
  }
  if (event.keyword) {
    const regExp = new db.RegExp({
      regexp: event.keyword,
      options: 'i'
    })
    condition = _.or(
      { ...condition, nick: regExp },
      { ...condition, mail: regExp },
      { ...condition, link: regExp },
      { ...condition, ip: regExp },
      { ...condition, comment: regExp },
      { ...condition, url: regExp },
      { ...condition, href: regExp }
    )
  }
  return condition
}

// 管理员修改评论
async function commentSetForAdmin (event) {
  const res = {}
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    validate(event, ['id', 'set'])
    const data = await db
      .collection('comment')
      .doc(event.id)
      .update({
        ...event.set,
        updated: Date.now()
      })
    res.code = RES_CODE.SUCCESS
    res.updated = data.updated
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
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

// 管理员导入评论
async function commentImportForAdmin (event) {
  const res = {}
  let logText = ''
  const log = (message) => {
    logText += `${new Date().toLocaleString()} ${message}\n`
  }
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    try {
      validate(event, ['source', 'fileId'])
      log(`开始导入 ${event.source}`)
      let comments
      switch (event.source) {
        case 'valine': {
          const valineDb = await readFile(event.fileId, 'json', log)
          comments = await commentImportValine(valineDb, log)
          break
        }
        case 'disqus': {
          const disqusDb = await readFile(event.fileId, 'xml', log)
          comments = await commentImportDisqus(disqusDb, log)
          break
        }
        case 'artalk': {
          const artalkDb = await readFile(event.fileId, 'json', log)
          comments = await commentImportArtalk(artalkDb, log)
          break
        }
        case 'artalk2': {
          const artalkDb = await readFile(event.fileId, 'json', log)
          comments = await commentImportArtalk2(artalkDb, log)
          break
        }
        case 'twikoo': {
          const twikooDb = await readFile(event.fileId, 'json', log)
          comments = await commentImportTwikoo(twikooDb, log)
          break
        }
        default:
          throw new Error(`不支持 ${event.source} 的导入，请更新 Twikoo 云函数至最新版本`)
      }
      const ids = await bulkSaveComments(comments)
      log(`导入成功 ${ids.length} 条评论`)
      // 删除导入完成的文件
      await app.deleteFile({ fileList: [event.fileId] })
    } catch (e) {
      log(e.message)
    }
    res.code = RES_CODE.SUCCESS
    res.log = logText
    logger.info(logText)
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentExportForAdmin (event) {
  const res = {}
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    const collection = event.collection || 'comment'
    const data = await db
      .collection(collection)
      .get()
    res.code = RES_CODE.SUCCESS
    res.data = data.data
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

// 读取云存储中的文件并转为 js object
async function readFile (fileId, type, log) {
  try {
    const result = await app.downloadFile({ fileID: fileId })
    log('评论文件下载成功')
    let content = result.fileContent.toString('utf8')
    log('评论文件读取成功')
    if (type === 'json') {
      content = jsonParse(content)
      log('评论文件 JSON 解析成功')
    } else if (type === 'xml') {
      content = await xml2js.parseStringPromise(content)
      log('评论文件 XML 解析成功')
    }
    return content
  } catch (e) {
    log(`评论文件读取失败：${e.message}`)
  }
}

// 批量导入评论
async function bulkSaveComments (comments) {
  const batchRes = await db
    .collection('comment')
    .add(comments)
  return batchRes.ids
}

// 点赞 / 反对 / 取消点赞
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
  const type = event.type || 'up'
  res.updated = await like(event.id, uid, type)
  return res
}

// 点赞 / 反对 / 取消
async function like (id, uid, type) {
  const record = db
    .collection('comment')
    .where({ _id: id })
  const comment = await record.get()
  const commentData = comment.data[0] || {}
  const ups = commentData.ups || []
  const downs = commentData.downs || []

  let newUps = [...ups]
  let newDowns = [...downs]

  if (type === 'up') {
    if (ups.includes(uid)) {
      newUps = ups.filter((item) => item !== uid)
    } else {
      newUps.push(uid)
      newDowns = downs.filter((item) => item !== uid)
    }
  } else if (type === 'down') {
    if (downs.includes(uid)) {
      newDowns = downs.filter((item) => item !== uid)
    } else {
      newDowns.push(uid)
      newUps = ups.filter((item) => item !== uid)
    }
  }

  const result = await record.update({ ups: newUps, downs: newDowns })
  return result.updated
}

/**
 * 提交评论。分为多个步骤
 * 1. 参数校验
 * 2. 预检测垃圾评论（包括限流、人工审核、违禁词检测等）
 * 3. 保存到数据库
 * 4. 触发异步任务（包括 IM 通知、邮件通知、第三方垃圾评论检测
 *    等，因为这些任务比较耗时，所以要放在另一个线程进行）
 * @param {String} event.nick 昵称
 * @param {String} event.mail 邮箱
 * @param {String} event.link 网址
 * @param {String} event.ua UserAgent
 * @param {String} event.url 评论页地址
 * @param {String} event.comment 评论内容
 * @param {String} event.pid 回复的 ID
 * @param {String} event.rid 评论楼 ID
 */
async function commentSubmit (event, context) {
  const res = {}
  // 参数校验
  validate(event, ['url', 'ua', 'comment'])
  // 限流
  await limitFilter()
  // 验证码
  await checkCaptcha(event)
  // 预检测、转换
  const data = await parse(event)
  // 保存
  const comment = await save(data)
  res.id = comment.id
  // 异步垃圾检测、发送评论通知
  try {
    await app.callFunction({
      name: context.function_name,
      data: { event: 'POST_SUBMIT', comment }
    }, { timeout: 300 }) // 设置较短的 timeout 来实现异步
  } catch (e) {
    logger.log('开始异步垃圾检测、发送评论通知')
  }
  return res
}

// 保存评论
async function save (data) {
  const result = await db
    .collection('comment')
    .add(data)
  data.id = result.id
  return data
}

async function getParentComment (currentComment) {
  const parentComment = await db
    .collection('comment')
    .where({ _id: currentComment.pid })
    .get()
  return parentComment.data[0]
}

// 异步垃圾检测、发送评论通知
async function postSubmit (comment, context) {
  if (!isRecursion(context)) return { code: RES_CODE.FORBIDDEN }
  // 垃圾检测
  const isSpam = await postCheckSpam(comment, config)
  await saveSpamCheckResult(comment, isSpam)
  // 发送通知
  await sendNotice(comment, config, getParentComment)
  return { code: RES_CODE.SUCCESS }
}

// 将评论转为数据库存储格式
async function parse (comment) {
  const timestamp = Date.now()
  const isAdminUser = await isAdmin()
  const isBloggerMail = equalsMail(comment.mail, config.BLOGGER_EMAIL)
  if (isBloggerMail && !isAdminUser) throw new Error('请先登录管理面板，再使用博主身份发送评论')
  const hashMethod = config.GRAVATAR_CDN === 'cravatar.cn' ? md5 : sha256
  const commentDo = {
    uid: await getUid(),
    nick: comment.nick ? comment.nick : '匿名',
    mail: comment.mail ? comment.mail : '',
    mailMd5: comment.mail ? hashMethod(normalizeMail(comment.mail)) : '',
    link: comment.link ? comment.link : '',
    ua: comment.ua,
    ip: auth.getClientIP(),
    master: isBloggerMail,
    url: comment.url,
    href: comment.href,
    comment: DOMPurify.sanitize(comment.comment, { FORBID_TAGS: ['style'], FORBID_ATTR: ['style'] }),
    pid: comment.pid ? comment.pid : comment.rid,
    rid: comment.rid,
    isSpam: isAdminUser ? false : preCheckSpam(comment, config),
    created: timestamp,
    updated: timestamp
  }
  if (isQQ(comment.mail)) {
    commentDo.mail = addQQMailSuffix(comment.mail)
    commentDo.mailMd5 = hashMethod(normalizeMail(commentDo.mail))
    commentDo.avatar = await getQQAvatar(comment.mail)
  }
  return commentDo
}

// 限流
async function limitFilter () {
  // 限制每个 IP 每 10 分钟发表的评论数量
  let limitPerMinute = parseInt(config.LIMIT_PER_MINUTE)
  if (Number.isNaN(limitPerMinute)) limitPerMinute = 10
  if (limitPerMinute) {
    let count = await db
      .collection('comment')
      .where({
        ip: auth.getClientIP(),
        created: _.gt(Date.now() - 600000)
      })
      .count()
    count = count.total
    if (count > limitPerMinute) {
      throw new Error('发言频率过高')
    }
  }
  // 限制所有 IP 每 10 分钟发表的评论数量
  let limitPerMinuteAll = parseInt(config.LIMIT_PER_MINUTE_ALL)
  if (Number.isNaN(limitPerMinuteAll)) limitPerMinuteAll = 10
  if (limitPerMinuteAll) {
    let count = await db
      .collection('comment')
      .where({
        created: _.gt(Date.now() - 600000)
      })
      .count()
    count = count.total
    if (count > limitPerMinuteAll) {
      throw new Error('评论太火爆啦 >_< 请稍后再试')
    }
  }
}

async function checkCaptcha (comment) {
  if (config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY) {
    await checkTurnstileCaptcha({
      ip: auth.getClientIP(),
      turnstileToken: comment.turnstileToken,
      turnstileTokenSecretKey: config.TURNSTILE_SECRET_KEY
    })
  }
  if (config.GEETEST_CAPTCHA_ID && config.GEETEST_CAPTCHA_KEY) {
    await checkGeeTestCaptcha({
      geeTestCaptchaId: config.GEETEST_CAPTCHA_ID,
      geeTestCaptchaKey: config.GEETEST_CAPTCHA_KEY,
      geeTestLotNumber: comment.geeTestLotNumber,
      geeTestCaptchaOutput: comment.geeTestCaptchaOutput,
      geeTestPassToken: comment.geeTestPassToken,
      geeTestGenTime: comment.geeTestGenTime
    })
  }
}

async function saveSpamCheckResult (comment, isSpam) {
  comment.isSpam = isSpam
  if (isSpam) {
    await db
      .collection('comment')
      .doc(comment.id)
      .update({
        isSpam,
        updated: Date.now()
      })
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
    const record = await readCounter(event.url)
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
      updated: Date.now()
    })
  if (result.updated === 0) {
    result = await db
      .collection('counter')
      .add({
        url: event.url,
        title: event.title,
        time: 1,
        created: Date.now(),
        updated: Date.now()
      })
  }
  return result.updated || result.inserted
}

/**
 * 批量获取文章评论数 API
 * @param {Array} event.urls 不包含协议和域名的文章路径列表，必传参数
 * @param {Boolean} event.includeReply 评论数是否包括回复，默认：false
 */
async function getCommentsCount (event) {
  const res = {}
  try {
    validate(event, ['urls'])
    const query = {}
    query.isSpam = _.neq(true)
    query.url = _.in(getUrlsQuery(event.urls))
    if (!event.includeReply) {
      query.rid = _.in(['', null])
    }
    const result = await db
      .collection('comment')
      .aggregate()
      .match(query)
      .group({ _id: '$url', count: _.aggregate.sum(1) })
      .end()
    res.data = []
    for (const url of event.urls) {
      const record = result.data.find((item) => item._id === url)
      res.data.push({
        url,
        count: record ? record.count : 0
      })
    }
  } catch (e) {
    res.message = e.message
    return res
  }
  return res
}

/**
 * 获取最新评论 API
 * @param {Boolean} event.includeReply 评论数是否包括回复，默认：false
 */
async function getRecentComments (event) {
  const res = {}
  try {
    const query = {}
    query.isSpam = _.neq(true)
    if (event.urls && event.urls.length) {
      query.url = _.in(getUrlsQuery(event.urls))
    }
    if (!event.includeReply) query.rid = _.in(['', null])
    if (event.pageSize > 100) event.pageSize = 100
    const result = await db
      .collection('comment')
      .where(query)
      .orderBy('created', 'desc')
      .limit(event.pageSize || 10)
      .get()
    res.data = result.data.map((comment) => {
      return {
        id: comment._id,
        url: comment.url,
        href: comment.href,
        nick: comment.nick,
        avatar: getAvatar(comment, config),
        mailMd5: getMailMd5(comment),
        link: comment.link,
        comment: comment.comment,
        commentText: $(comment.comment).text(),
        created: comment.created
      }
    })
  } catch (e) {
    res.message = e.message
    return res
  }
  return res
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

function protect () {
  // 防御
  const ip = auth.getClientIP()
  requestTimes[ip] = (requestTimes[ip] || 0) + 1
  if (requestTimes[ip] > MAX_REQUEST_TIMES) {
    logger.warn(`${ip} 当前请求次数为 ${requestTimes[ip]}，已超过最大请求次数`)
    throw new Error('Too Many Requests')
  } else {
    logger.log(`${ip} 当前请求次数为 ${requestTimes[ip]}`)
  }
}

// 读取配置
async function readConfig () {
  try {
    const res = await db
      .collection('config')
      .limit(1)
      .get()
    config = res.data[0] || {}
    return config
  } catch (e) {
    logger.error('读取配置失败：', e)
    await createCollections()
    config = {}
    return config
  }
}

// 写入配置
async function writeConfig (newConfig) {
  if (!Object.keys(newConfig).length) return 0
  logger.info('写入配置：', newConfig)
  try {
    let updated
    let res = await db
      .collection('config')
      .where({}) // 不加 where 会报错 Error: param should have required property 'query'
      .limit(1)
      .update(newConfig)
    updated = res.updated
    if (updated === 0) {
      res = await db
        .collection('config')
        .add(newConfig)
      updated = res.id ? 1 : 0
    }
    // 更新后重置配置缓存
    if (updated > 0) config = null
    return updated
  } catch (e) {
    logger.error('写入配置失败：', e)
    return null
  }
}

// 获取用户 ID
async function getUid () {
  const { userInfo } = await auth.getEndUserInfo()
  return userInfo.uid
}

// 判断用户是否管理员
async function isAdmin () {
  const userInfo = await auth.getEndUserInfo()
  return ADMIN_USER_ID === userInfo.userInfo.customUserId
}

// 判断是否为递归调用（即云函数调用自身）
function isRecursion (context) {
  const envObj = tcb.getCloudbaseContext(context)
  return envObj.TCB_SOURCE.substr(-3, 3) === 'scf'
}

// 建立数据库 collections
async function createCollections () {
  const collections = ['comment', 'config', 'counter']
  const res = {}
  for (const collection of collections) {
    try {
      res[collection] = await db.createCollection(collection)
    } catch (e) {
      logger.error('建立数据库失败：', e)
    }
  }
  return res
}

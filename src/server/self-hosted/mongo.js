/*!
 * Twikoo self-hosted function mongodb ver
 * (c) 2020-present iMaeGoo
 * Released under the MIT License.
 */

const { version: VERSION } = require('./package.json')
const MongoClient = require('mongodb').MongoClient
const getUserIP = require('get-user-ip')
const { URL } = require('url')
const { v4: uuidv4 } = require('uuid') // 用户 id 生成
const {
  getCheerio,
  getDomPurify,
  getMd5,
  getSha256,
  getXml2js
} = require('twikoo-func/utils/lib')
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
  getConfig,
  getConfigForAdmin,
  validate
} = require('twikoo-func/utils')
const {
  jsonParse,
  commentImportValine,
  commentImportDisqus,
  commentImportArtalk,
  commentImportArtalk2,
  commentImportTwikoo
} = require('twikoo-func/utils/import')
const { postCheckSpam } = require('twikoo-func/utils/spam')
const { sendNotice, emailTest } = require('twikoo-func/utils/notify')
const { uploadImage } = require('twikoo-func/utils/image')
const logger = require('twikoo-func/utils/logger')

const $ = getCheerio()
const DOMPurify = getDomPurify()
const md5 = getMd5()
const sha256 = getSha256()
const xml2js = getXml2js()

// 常量 / constants
const { RES_CODE, MAX_REQUEST_TIMES } = require('twikoo-func/utils/constants')
const TWIKOO_REQ_TIMES_CLEAR_TIME = parseInt(process.env.TWIKOO_REQ_TIMES_CLEAR_TIME) || 10 * 60 * 1000

// 全局变量 / variables
let db = null
let config
let requestTimes = {}

module.exports = async (request, response) => {
  let accessToken
  const event = request.body || {}
  logger.log('请求 IP：', getIp(request))
  logger.log('请求函数：', event.event)
  logger.log('请求参数：', event)
  let res = {}
  try {
    protect(request)
    accessToken = anonymousSignIn(request)
    await connectToDatabase(process.env.MONGODB_URI || process.env.MONGO_URL)
    await readConfig()
    allowCors(request, response)
    if (request.method === 'OPTIONS') {
      response.status(204).end()
      return
    }
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
        res = await commentSubmit(event, request)
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
        res = await getConfig({ config, VERSION, isAdmin: isAdmin(event.accessToken) })
        break
      case 'GET_CONFIG_FOR_ADMIN':
        res = await getConfigForAdmin({ config, isAdmin: isAdmin(event.accessToken) })
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
        res = await emailTest(event, config, isAdmin(event.accessToken))
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
          res.code = RES_CODE.NO_PARAM
          res.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置'
          res.version = VERSION
        }
    }
  } catch (e) {
    logger.error('Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/twikoojs/twikoo/issues')
    logger.error('请求参数：', event)
    logger.error('错误信息：', e)
    res.code = RES_CODE.FAIL
    res.message = e.message
  }
  if (!res.code && !request.body.accessToken) {
    res.accessToken = accessToken
  }
  logger.log('请求返回：', res)
  response.status(200).json(res)
}

function allowCors (request, response) {
  if (request.headers.origin) {
    response.setHeader('Access-Control-Allow-Credentials', true)
    response.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(request))
    response.setHeader('Access-Control-Allow-Methods', 'POST')
    response.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )
    response.setHeader('Access-Control-Max-Age', '600')
  }
}

function getAllowedOrigin (request) {
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/
  if (localhostRegex.test(request.headers.origin)) { // 判断是否为本地主机，如是则允许跨域
    return request.headers.origin // Allow
  } else if (config.CORS_ALLOW_ORIGIN) { // 如设置了安全域名则检查
    // 适配多条 CORS 规则
    // 以逗号分隔 CORS
    const corsList = config.CORS_ALLOW_ORIGIN.split(',')
    // 遍历 CORS 列表
    for (let i = 0; i < corsList.length; i++) {
      const cors = corsList[i].replace(/\/$/, '') // 获取当前 CORS 并去除末尾的斜杠
      if (cors === request.headers.origin) {
        return request.headers.origin // Allow
      }
    }
    return '' // 不在安全域名列表中则禁止跨域
  } else {
    return request.headers.origin // 未设置安全域名直接 Allow
  }
}

function anonymousSignIn (request) {
  if (request.body) {
    if (request.body.accessToken) {
      return request.body.accessToken
    } else {
      return uuidv4().replace(/-/g, '')
    }
  }
}

// A function for connecting to MongoDB,
// taking a single parameter of the connection string
async function connectToDatabase (uri) {
  // If the database connection is cached,
  // use it instead of creating a new connection
  if (db) return db
  if (!uri) throw new Error('未设置环境变量 MONGODB_URI | MONGO_URL')
  // If no connection is cached, create a new one
  logger.info('Connecting to database...')
  const client = await MongoClient.connect(uri, {})
  // Select the database through the connection,
  // using the database path of the connection string
  const dbName = (new URL(uri)).pathname.substring(1) || 'twikoo'
  db = await client.db(dbName)
  // Cache the database connection and return the connection
  logger.info('Connected to database')
  return db
}

// 写入管理密码
async function setPassword (event) {
  const isAdminUser = isAdmin(event.accessToken)
  // 如果数据库里没有密码，则写入密码
  // 如果数据库里有密码，则只有管理员可以写入密码
  if (config.ADMIN_PASS && !isAdminUser) {
    return { code: RES_CODE.PASS_EXIST, message: '请先登录再修改密码' }
  }
  const ADMIN_PASS = md5(event.password)
  await writeConfig({ ADMIN_PASS })
  return {
    code: RES_CODE.SUCCESS
  }
}

// 管理员登录
async function login (password) {
  if (!config) {
    return { code: RES_CODE.CONFIG_NOT_EXIST, message: '数据库无配置' }
  }
  if (!config.ADMIN_PASS) {
    return { code: RES_CODE.PASS_NOT_EXIST, message: '未配置管理密码' }
  }
  if (config.ADMIN_PASS !== md5(password)) {
    return { code: RES_CODE.PASS_NOT_MATCH, message: '密码错误' }
  }
  return {
    code: RES_CODE.SUCCESS
  }
}

// 读取评论
async function commentGet (event) {
  const res = {}
  try {
    validate(event, ['url'])
    const uid = event.accessToken
    const isAdminUser = isAdmin(event.accessToken)
    const limit = parseInt(config.COMMENT_PAGE_SIZE) || 8
    let more = false
    let condition
    let query
    condition = {
      url: { $in: getUrlQuery(event.url) },
      rid: { $in: ['', null] }
    }
    // 查询非垃圾评论 + 自己的评论
    query = getCommentQuery({ condition, uid, isAdminUser })
    // 读取总条数
    const count = await db
      .collection('comment')
      .countDocuments(query)
    // 读取主楼
    if (event.before) {
      condition.created = { $lt: event.before }
    }
    // 不包含置顶
    condition.top = { $ne: true }
    query = getCommentQuery({ condition, uid, isAdminUser })
    let main = await db
      .collection('comment')
      .find(query)
      .sort({ created: -1 })
      // 流式分页，通过多读 1 条的方式，确认是否还有更多评论
      .limit(limit + 1)
      .toArray()
    if (main.length > limit) {
      // 还有更多评论
      more = true
      // 删除多读的 1 条
      main.splice(limit, 1)
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
        .find(query)
        .sort({ created: -1 })
        .toArray()
      // 合并置顶评论和非置顶评论
      main = [
        ...top,
        ...main
      ]
    }
    condition = {
      rid: { $in: main.map((item) => item._id.toString()) }
    }
    query = getCommentQuery({ condition, uid, isAdminUser })
    // 读取回复楼
    const reply = await db
      .collection('comment')
      .find(query)
      .toArray()
    res.data = parseComment([...main, ...reply], uid, config)
    res.more = more
    res.count = count
  } catch (e) {
    res.data = []
    res.message = e.message
  }
  return res
}

function getCommentQuery ({ condition, uid, isAdminUser }) {
  return {
    $or: [
      { ...condition, isSpam: { $ne: isAdminUser ? 'imaegoo' : true } },
      { ...condition, uid }
    ]
  }
}

// 管理员读取评论
async function commentGetForAdmin (event) {
  const res = {}
  const isAdminUser = isAdmin(event.accessToken)
  if (isAdminUser) {
    validate(event, ['per', 'page'])
    const collection = db
      .collection('comment')
    const condition = getCommentSearchCondition(event)
    const count = await collection.countDocuments(condition)
    const data = await collection
      .find(condition)
      .sort({ created: -1 })
      .skip(event.per * (event.page - 1))
      .limit(event.per)
      .toArray()
    res.code = RES_CODE.SUCCESS
    res.count = count
    res.data = parseCommentForAdmin(data)
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

function getCommentSearchCondition (event) {
  let condition
  if (event.type) {
    switch (event.type) {
      case 'VISIBLE':
        condition = { isSpam: { $ne: true } }
        break
      case 'HIDDEN':
        condition = { isSpam: true }
        break
    }
  }
  if (event.keyword) {
    const regExp = {
      $regex: event.keyword,
      $options: 'i'
    }
    condition = {
      $or: [
        { ...condition, nick: regExp },
        { ...condition, mail: regExp },
        { ...condition, link: regExp },
        { ...condition, ip: regExp },
        { ...condition, comment: regExp },
        { ...condition, url: regExp },
        { ...condition, href: regExp }
      ]
    }
  }
  return condition
}

// 管理员修改评论
async function commentSetForAdmin (event) {
  const res = {}
  const isAdminUser = isAdmin(event.accessToken)
  if (isAdminUser) {
    validate(event, ['id', 'set'])
    const data = await db
      .collection('comment')
      .updateOne({ _id: event.id }, {
        $set: {
          ...event.set,
          updated: Date.now()
        }
      })
    res.code = RES_CODE.SUCCESS
    res.updated = data
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

// 管理员删除评论
async function commentDeleteForAdmin (event) {
  const res = {}
  const isAdminUser = isAdmin(event.accessToken)
  if (isAdminUser) {
    validate(event, ['id'])
    const data = await db
      .collection('comment')
      .deleteOne({ _id: event.id })
    res.code = RES_CODE.SUCCESS
    res.deleted = data.deletedCount
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
  const isAdminUser = isAdmin(event.accessToken)
  if (isAdminUser) {
    try {
      validate(event, ['source', 'file'])
      log(`开始导入 ${event.source}`)
      let comments
      switch (event.source) {
        case 'valine': {
          const valineDb = await readFile(event.file, 'json', log)
          comments = await commentImportValine(valineDb, log)
          break
        }
        case 'disqus': {
          const disqusDb = await readFile(event.file, 'xml', log)
          comments = await commentImportDisqus(disqusDb, log)
          break
        }
        case 'artalk': {
          const artalkDb = await readFile(event.file, 'json', log)
          comments = await commentImportArtalk(artalkDb, log)
          break
        }
        case 'artalk2': {
          const artalkDb = await readFile(event.file, 'json', log)
          comments = await commentImportArtalk2(artalkDb, log)
          break
        }
        case 'twikoo': {
          const twikooDb = await readFile(event.file, 'json', log)
          comments = await commentImportTwikoo(twikooDb, log)
          break
        }
        default:
          throw new Error(`不支持 ${event.source} 的导入，请更新 Twikoo 云函数至最新版本`)
      }
      const insertedCount = await bulkSaveComments(comments)
      log(`导入成功 ${insertedCount} 条评论`)
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
  const isAdminUser = isAdmin(event.accessToken)
  if (isAdminUser) {
    const collection = event.collection || 'comment'
    const data = await db
      .collection(collection)
      .find({})
      .toArray()
    res.code = RES_CODE.SUCCESS
    res.data = data
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

// 读取文件并转为 js object
async function readFile (file, type, log) {
  try {
    let content = file.toString('utf8')
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
    .insertMany(comments)
  return batchRes.insertedCount
}

// 点赞 / 取消点赞
async function commentLike (event) {
  const res = {}
  validate(event, ['id'])
  res.updated = await like(event.id, event.accessToken)
  return res
}

// 点赞 / 取消点赞
async function like (id, uid) {
  const record = db
    .collection('comment')
  const comment = await record
    .findOne({ _id: id })
  let likes = comment && comment.like ? comment.like : []
  if (likes.findIndex((item) => item === uid) === -1) {
    // 赞
    likes.push(uid)
  } else {
    // 取消赞
    likes = likes.filter((item) => item !== uid)
  }
  const result = await record.updateOne({ _id: id }, {
    $set: { like: likes }
  })
  return result
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
async function commentSubmit (event, request) {
  const res = {}
  // 参数校验
  validate(event, ['url', 'ua', 'comment'])
  // 限流
  await limitFilter(request)
  // 验证码
  await checkCaptcha(event, request)
  // 预检测、转换
  const data = await parse(event, request)
  // 保存
  const comment = await save(data)
  res.id = comment.id
  // 异步垃圾检测、发送评论通知
  logger.log('开始异步垃圾检测、发送评论通知')
  // 私有部署支持直接异步调用
  postSubmit(comment)
  return res
}

// 保存评论
async function save (data) {
  await db
    .collection('comment')
    .insertOne(data)
  data.id = data._id
  return data
}

async function getParentComment (currentComment) {
  const parentComment = await db
    .collection('comment')
    .findOne({ _id: currentComment.pid })
  return parentComment
}

// 异步垃圾检测、发送评论通知
async function postSubmit (comment) {
  try {
    logger.log('POST_SUBMIT')
    // 垃圾检测
    const isSpam = await postCheckSpam(comment, config)
    await saveSpamCheckResult(comment, isSpam)
    // 发送通知
    await sendNotice(comment, config, getParentComment)
  } catch (e) {
    logger.warn('POST_SUBMIT 失败', e)
  }
}

// 将评论转为数据库存储格式
async function parse (comment, request) {
  const timestamp = Date.now()
  const isAdminUser = isAdmin(request.body.accessToken)
  const isBloggerMail = equalsMail(comment.mail, config.BLOGGER_EMAIL)
  if (isBloggerMail && !isAdminUser) throw new Error('请先登录管理面板，再使用博主身份发送评论')
  const hashMethod = config.GRAVATAR_CDN === 'cravatar.cn' ? md5 : sha256
  const commentDo = {
    _id: uuidv4().replace(/-/g, ''),
    uid: request.body.accessToken,
    nick: comment.nick ? comment.nick : '匿名',
    mail: comment.mail ? comment.mail : '',
    mailMd5: comment.mail ? hashMethod(normalizeMail(comment.mail)) : '',
    link: comment.link ? comment.link : '',
    ua: comment.ua,
    ip: getIp(request),
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
async function limitFilter (request) {
  // 限制每个 IP 每 10 分钟发表的评论数量
  let limitPerMinute = parseInt(config.LIMIT_PER_MINUTE)
  if (Number.isNaN(limitPerMinute)) limitPerMinute = 10
  if (limitPerMinute) {
    const count = await db
      .collection('comment')
      .countDocuments({
        ip: getIp(request),
        created: { $gt: Date.now() - 600000 }
      })
    if (count > limitPerMinute) {
      throw new Error('发言频率过高')
    }
  }
  // 限制所有 IP 每 10 分钟发表的评论数量
  let limitPerMinuteAll = parseInt(config.LIMIT_PER_MINUTE_ALL)
  if (Number.isNaN(limitPerMinuteAll)) limitPerMinuteAll = 10
  if (limitPerMinuteAll) {
    const count = await db
      .collection('comment')
      .countDocuments({
        created: { $gt: Date.now() - 600000 }
      })
    if (count > limitPerMinuteAll) {
      throw new Error('评论太火爆啦 >_< 请稍后再试')
    }
  }
}

async function checkCaptcha (comment, request) {
  if (config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY) {
    await checkTurnstileCaptcha({
      ip: getIp(request),
      turnstileToken: comment.turnstileToken,
      turnstileTokenSecretKey: config.TURNSTILE_SECRET_KEY
    })
  }
}

async function saveSpamCheckResult (comment, isSpam) {
  comment.isSpam = isSpam
  if (isSpam) {
    await db
      .collection('comment')
      .updateOne({ created: comment.created }, {
        $set: {
          isSpam,
          updated: Date.now()
        }
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
    res.data = record || {}
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
    .findOne({ url })
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
    .updateOne({ url: event.url }, {
      $inc: { time: 1 },
      $set: {
        title: event.title,
        updated: Date.now()
      }
    })
  if (result.modifiedCount === 0) {
    result = await db
      .collection('counter')
      .insertOne({
        url: event.url,
        title: event.title,
        time: 1,
        created: Date.now(),
        updated: Date.now()
      })
  }
  return result.modifiedCount || result.insertedCount
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
    query.isSpam = { $ne: true }
    query.url = { $in: getUrlsQuery(event.urls) }
    if (!event.includeReply) {
      query.rid = { $in: ['', null] }
    }
    const result = await db
      .collection('comment')
      .aggregate([
        { $match: query },
        { $group: { _id: '$url', count: { $sum: 1 } } }
      ])
      .toArray()
    res.data = []
    for (const url of event.urls) {
      const record = result.find((item) => item._id === url)
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
    query.isSpam = { $ne: true }
    if (event.urls && event.urls.length) {
      query.url = { $in: getUrlsQuery(event.urls) }
    }
    if (!event.includeReply) query.rid = { $in: ['', null] }
    if (event.pageSize > 100) event.pageSize = 100
    const result = await db
      .collection('comment')
      .find(query)
      .sort({ created: -1 })
      .limit(event.pageSize || 10)
      .toArray()
    res.data = result.map((comment) => {
      return {
        id: comment._id.toString(),
        url: comment.url,
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
  const isAdminUser = isAdmin(event.accessToken)
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

function protect (request) {
  // 防御
  const ip = getIp(request)
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
      .findOne({})
    config = res || {}
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
      .updateOne({}, { $set: newConfig })
    updated = res.modifiedCount
    if (updated === 0) {
      res = await db
        .collection('config')
        .insertOne(newConfig)
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

// 判断用户是否管理员
function isAdmin (accessToken) {
  return config.ADMIN_PASS === md5(accessToken)
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

function getIp (request) {
  try {
    const { TWIKOO_IP_HEADERS } = process.env
    const headers = TWIKOO_IP_HEADERS ? JSON.parse(TWIKOO_IP_HEADERS) : []
    return getUserIP(request, headers)
  } catch (e) {
    logger.error('获取 IP 错误信息：', e)
  }
  return getUserIP(request)
}

function clearRequestTimes () {
  requestTimes = {}
}

setInterval(clearRequestTimes, TWIKOO_REQ_TIMES_CLEAR_TIME)

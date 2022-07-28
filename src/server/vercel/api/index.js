/*!
 * Twikoo vercel function
 * (c) 2020-present iMaeGoo
 * Released under the MIT License.
 */

const { version: VERSION } = require('../package.json')
const MongoClient = require('mongodb').MongoClient
const { URL } = require('url')
const { v4: uuidv4 } = require('uuid') // 用户 id 生成
const {
  $,
  JSDOM,
  axios,
  createDOMPurify,
  md5,
  xml2js
} = require('twikoo-func/utils/lib')
const {
  getFuncVersion,
  getUrlQuery,
  getUrlsQuery,
  parseComment,
  parseCommentForAdmin,
  getAvatar,
  isQQ,
  addQQMailSuffix,
  getQQAvatar,
  getPasswordStatus,
  preCheckSpam,
  getConfig,
  getConfigForAdmin,
  validate
} = require('twikoo-func/utils')
const {
  jsonParse,
  commentImportValine,
  commentImportDisqus,
  commentImportArtalk,
  commentImportTwikoo
} = require('twikoo-func/utils/import')
const { postCheckSpam } = require('twikoo-func/utils/spam')
const { sendNotice, emailTest } = require('twikoo-func/utils/notify')
const { uploadImage } = require('./utils/image')

// 初始化反 XSS
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

// 常量 / constants
const { RES_CODE, MAX_REQUEST_TIMES } = require('twikoo-func/utils/constants')

// 全局变量 / variables
let db = null
let config
let request
let response
let accessToken
const requestTimes = {}

module.exports = async (requestArg, responseArg) => {
  request = requestArg
  response = responseArg
  const event = request.body || {}
  console.log('请求ＩＰ：', request.headers['x-real-ip'])
  console.log('请求方法：', event.event)
  console.log('请求参数：', event)
  let res = {}
  try {
    protect()
    anonymousSignIn()
    await connectToDatabase(process.env.MONGODB_URI)
    await readConfig()
    allowCors()
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
        res = await commentSubmit(event)
        break
      case 'POST_SUBMIT':
        res = await postSubmit(event.comment)
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
        res = await getConfig({ config, VERSION, isAdmin })
        break
      case 'GET_CONFIG_FOR_ADMIN':
        res = await getConfigForAdmin({ config, isAdmin })
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
        res = await emailTest(event, config, isAdmin)
        break
      case 'UPLOAD_IMAGE': // >= 1.5.0
        res = await uploadImage(event, config)
        break
      default:
        if (event.event) {
          res.code = RES_CODE.EVENT_NOT_EXIST
          res.message = '请更新 Twikoo 云函数至最新版本'
        } else {
          res.code = RES_CODE.NO_PARAM
          res.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/quick-start.html#%E5%89%8D%E7%AB%AF%E9%83%A8%E7%BD%B2 完成前端的配置'
          res.version = VERSION
        }
    }
  } catch (e) {
    console.error('Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/imaegoo/twikoo/issues')
    console.error('请求参数：', event)
    console.error('错误信息：', e)
    res.code = RES_CODE.FAIL
    res.message = e.message
  }
  if (!res.code && !request.body.accessToken) {
    res.accessToken = accessToken
  }
  console.log('请求返回：', res)
  response.status(200).json(res)
}

function allowCors () {
  if (request.headers.origin) {
    response.setHeader('Access-Control-Allow-Credentials', true)
    response.setHeader('Access-Control-Allow-Origin', getAllowedOrigin())
    response.setHeader('Access-Control-Allow-Methods', 'POST')
    response.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )
  }
}

function getAllowedOrigin () {
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/
  if (localhostRegex.test(request.headers.origin)) {
    return request.headers.origin
  } else if (config.CORS_ALLOW_ORIGIN) {
    // 许多用户设置安全域名时，喜欢带结尾的 "/"，必须处理掉
    return config.CORS_ALLOW_ORIGIN.replace(/\/$/, '')
  } else {
    return request.headers.origin
  }
}

function anonymousSignIn () {
  if (request.body) {
    if (request.body.accessToken) {
      accessToken = request.body.accessToken
    } else {
      accessToken = uuidv4().replace(/-/g, '')
    }
  }
}

// A function for connecting to MongoDB,
// taking a single parameter of the connection string
async function connectToDatabase (uri) {
  // If the database connection is cached,
  // use it instead of creating a new connection
  if (db) return db
  if (!uri) throw new Error('未设置环境变量 MONGODB_URI')
  // If no connection is cached, create a new one
  console.log('Connecting to database...')
  const client = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  // Select the database through the connection,
  // using the database path of the connection string
  db = await client.db((new URL(uri)).pathname.substr(1))
  // Cache the database connection and return the connection
  console.log('Connected to database')
  return db
}

// 写入管理密码
async function setPassword (event) {
  const isAdminUser = await isAdmin()
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
    const uid = await getUid()
    const isAdminUser = await isAdmin()
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
    res.data = parseComment([...main, ...reply], uid)
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
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    validate(event, ['per', 'page'])
    const collection = db
      .collection('comment')
    const condition = getCommentSearchCondition(event)
    const count = await collection.countDocuments()
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
  let condition = {}
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
  const isAdminUser = await isAdmin()
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
  const isAdminUser = await isAdmin()
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
  const isAdminUser = await isAdmin()
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
    console.log(logText)
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
  res.updated = await like(event.id, await getUid())
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
async function commentSubmit (event) {
  const res = {}
  // 参数校验
  validate(event, ['url', 'ua', 'comment'])
  // 限流
  await limitFilter()
  // 预检测、转换
  const data = await parse(event)
  // 保存
  const comment = await save(data)
  res.id = comment.id
  // 异步垃圾检测、发送评论通知
  try {
    console.log('开始异步垃圾检测、发送评论通知')
    console.time('POST_SUBMIT')
    await Promise.race([
      axios.post(`https://${process.env.VERCEL_URL}`, {
        event: 'POST_SUBMIT',
        comment
      }, { headers: { 'x-twikoo-recursion': config.ADMIN_PASS || 'true' } }),
      // 如果超过 5 秒还没收到异步返回，直接继续，减少用户等待的时间
      new Promise((resolve) => setTimeout(resolve, 5000))
    ])
    console.timeEnd('POST_SUBMIT')
  } catch (e) {
    console.log('POST_SUBMIT 失败', e)
  }
  return res
}

// 保存评论
async function save (event) {
  const data = await parse(event)
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
  return parentComment.data[0]
}

// 异步垃圾检测、发送评论通知
async function postSubmit (comment) {
  if (!isRecursion()) return { code: RES_CODE.FORBIDDEN }
  // 垃圾检测
  const isSpam = await postCheckSpam(comment)
  await saveSpamCheckResult(comment, isSpam)
  // 发送通知
  await sendNotice(comment, config, getParentComment)
  return { code: RES_CODE.SUCCESS }
}

// 将评论转为数据库存储格式
async function parse (comment) {
  const timestamp = Date.now()
  const isAdminUser = await isAdmin()
  const isBloggerMail = comment.mail && comment.mail === config.BLOGGER_EMAIL
  if (isBloggerMail && !isAdminUser) throw new Error('请先登录管理面板，再使用博主身份发送评论')
  const commentDo = {
    _id: uuidv4().replace(/-/g, ''),
    uid: await getUid(),
    nick: comment.nick ? comment.nick : '匿名',
    mail: comment.mail ? comment.mail : '',
    mailMd5: comment.mail ? md5(comment.mail) : '',
    link: comment.link ? comment.link : '',
    ua: comment.ua,
    ip: request.headers['x-real-ip'],
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
    commentDo.mailMd5 = md5(commentDo.mail)
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
    const count = await db
      .collection('comment')
      .countDocuments({
        ip: request.headers['x-real-ip'],
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
        mailMd5: comment.mailMd5 || md5(comment.mail),
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
  const ip = request.headers['x-real-ip']
  requestTimes[ip] = (requestTimes[ip] || 0) + 1
  if (requestTimes[ip] > MAX_REQUEST_TIMES) {
    console.log(`${ip} 当前请求次数为 ${requestTimes[ip]}，已超过最大请求次数`)
    throw new Error('Too Many Requests')
  } else {
    console.log(`${ip} 当前请求次数为 ${requestTimes[ip]}`)
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
    console.error('读取配置失败：', e)
    await createCollections()
    config = {}
    return config
  }
}

// 写入配置
async function writeConfig (newConfig) {
  if (!Object.keys(newConfig).length) return 0
  console.log('写入配置：', newConfig)
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
    console.error('写入配置失败：', e)
    return null
  }
}

// 获取用户 ID
async function getUid () {
  return accessToken
}

// 判断用户是否管理员
async function isAdmin () {
  const uid = await getUid()
  return config.ADMIN_PASS === md5(uid)
}

// 判断是否为递归调用（即云函数调用自身）
function isRecursion () {
  return request.headers['x-twikoo-recursion'] === (config.ADMIN_PASS || 'true')
}

// 建立数据库 collections
async function createCollections () {
  const collections = ['comment', 'config', 'counter']
  const res = {}
  for (const collection of collections) {
    try {
      res[collection] = await db.createCollection(collection)
    } catch (e) {
      console.error('建立数据库失败：', e)
    }
  }
  return res
}

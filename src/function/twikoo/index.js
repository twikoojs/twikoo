/*!
 * Twikoo cloudbase function v1.3.1
 * (c) 2020-2021 iMaeGoo
 * Released under the MIT License.
 */

// 三方依赖 / 3rd party dependencies
const tcb = require('@cloudbase/node-sdk') // 云开发 SDK
const md5 = require('blueimp-md5') // MD5 加解密
const bowser = require('bowser') // UserAgent 格式化
const nodemailer = require('nodemailer') // 发送邮件
const axios = require('axios') // 发送 REST 请求
const qs = require('querystring') // URL 参数格式化
const $ = require('cheerio') // jQuery 服务器版
const { AkismetClient } = require('akismet-api') // 反垃圾 API
const createDOMPurify = require('dompurify') // 反 XSS
const { JSDOM } = require('jsdom') // document.window 服务器版
const xml2js = require('xml2js') // XML 解析
const marked = require('marked') // Markdown 解析
const CryptoJS = require('crypto-js') // 编解码
const tencentcloud = require('tencentcloud-sdk-nodejs') // 腾讯云 API NODEJS SDK

// 云函数 SDK / tencent cloudbase sdk
const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()
const _ = db.command

// 初始化反 XSS
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

// 常量 / constants
const VERSION = '1.3.1'
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
  NEED_LOGIN: 1024,
  FORBIDDEN: 1403,
  AKISMET_ERROR: 1030
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
        res = await postSubmit(event.comment, context)
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
        res = getConfig()
        break
      case 'GET_CONFIG_FOR_ADMIN':
        res = await getConfigForAdmin()
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
      default:
        if (event.event) {
          res.code = RES_CODE.EVENT_NOT_EXIST
          res.message = '请更新 Twikoo 云函数至最新版本'
        } else {
          res.code = RES_CODE.SUCCESS
          res.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/quick-start.html#%E5%89%8D%E7%AB%AF%E9%83%A8%E7%BD%B2 完成前端的配置'
        }
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
  return {
    code: RES_CODE.SUCCESS,
    status: !!config.ADMIN_PASS,
    credentials: !!config.CREDENTIALS,
    version: VERSION
  }
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
    console.error('私钥文件异常：', e)
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
    const main = await db
      .collection('comment')
      .where(query)
      .orderBy('created', 'desc')
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
    res.data = parseComment([...main.data, ...reply.data], uid)
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

// 同时查询 /path 和 /path/ 的评论
function getUrlQuery (url) {
  const variantUrl = url[url.length - 1] === '/' ? url.substring(0, url.length - 1) : `${url}/`
  return [url, variantUrl]
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
    avatar: comment.avatar,
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
    top: comment.top,
    isSpam: comment.isSpam,
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

function parseCommentForAdmin (comments) {
  for (const comment of comments) {
    comment.commentText = $(comment.comment).text()
  }
  return comments
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
      switch (event.source) {
        case 'valine': {
          const valineDb = await readFile(event.fileId, 'json', log)
          await commentImportValine(valineDb, log)
          break
        }
        case 'disqus': {
          const disqusDb = await readFile(event.fileId, 'xml', log)
          await commentImportDisqus(disqusDb, log)
          break
        }
        case 'artalk': {
          const artalkDb = await readFile(event.fileId, 'json', log)
          await commentImportArtalk(artalkDb, log)
          break
        }
        default:
          throw new Error(`不支持 ${event.source} 的导入，请更新 Twikoo 云函数至最新版本`)
      }
      // 删除导入完成的文件
      await app.deleteFile({ fileList: [event.fileId] })
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

// 兼容 Leancloud 两种 JSON 导出格式
function jsonParse (content) {
  try {
    return JSON.parse(content)
  } catch (e1) {
    const results = []
    const lines = content.split('\n')
    for (const line of lines) {
      // 逐行 JSON.parse
      try {
        results.push(JSON.parse(line))
      } catch (e2) {}
    }
    return { results }
  }
}

// Valine 导入
async function commentImportValine (valineDb, log) {
  if (!valineDb || !valineDb.results) {
    log('Valine 评论文件格式有误')
    return
  }
  const comments = []
  log(`共 ${valineDb.results.length} 条评论`)
  for (const comment of valineDb.results) {
    try {
      const parsed = {
        _id: comment.objectId,
        nick: comment.nick,
        ip: comment.ip,
        mail: comment.mail,
        mailMd5: comment.mailMd5,
        isSpam: comment.isSpam,
        ua: comment.ua || '',
        link: comment.link,
        pid: comment.pid,
        rid: comment.rid,
        master: false,
        comment: comment.comment,
        url: comment.url,
        created: new Date(comment.createdAt).getTime(),
        updated: new Date(comment.updatedAt).getTime()
      }
      comments.push(parsed)
      log(`${comment.objectId} 解析成功`)
    } catch (e) {
      log(`${comment.objectId} 解析失败：${e.message}`)
    }
  }
  log(`解析成功 ${comments.length} 条评论`)
  const ids = await bulkSaveComments(comments)
  log(`导入成功 ${ids.length} 条评论`)
  return comments
}

// Disqus 导入
async function commentImportDisqus (disqusDb, log) {
  if (!disqusDb || !disqusDb.disqus || !disqusDb.disqus.thread || !disqusDb.disqus.post) {
    log('Disqus 评论文件格式有误')
    return
  }
  const comments = []
  const getParent = (post) => {
    return post.parent ? disqusDb.disqus.post.find((item) => item.$['dsq:id'] === post.parent[0].$['dsq:id']) : null
  }
  let threads = []
  try {
    threads = disqusDb.disqus.thread.map((thread) => {
      return {
        id: thread.$['dsq:id'],
        title: thread.title[0],
        url: thread.id[0],
        href: thread.link[0]
      }
    })
  } catch (e) {
    log(`无法读取 thread：${e.message}`)
    return
  }
  log(`共 ${disqusDb.disqus.post.length} 条评论`)
  for (const post of disqusDb.disqus.post) {
    try {
      const threadId = post.thread[0].$['dsq:id']
      const thread = threads.find((item) => item.id === threadId)
      const parent = getParent(post)
      let root
      if (parent) {
        let grandParent = parent
        while (true) {
          if (grandParent) root = grandParent
          else break
          grandParent = getParent(grandParent)
        }
      }
      comments.push({
        _id: post.$['dsq:id'],
        nick: post.author[0].name[0],
        mail: '',
        link: '',
        url: thread.url
          ? thread.url.indexOf('http') === 0
            ? getRelativeUrl(thread.url)
            : thread.url
          : getRelativeUrl(thread.href),
        href: thread.href,
        comment: post.message[0],
        ua: '',
        ip: '',
        isSpam: post.isSpam[0] === 'true' || post.isDeleted[0] === 'true',
        master: false,
        pid: parent ? parent.$['dsq:id'] : null,
        rid: root ? root.$['dsq:id'] : null,
        created: new Date(post.createdAt[0]).getTime(),
        updated: Date.now()
      })
      log(`${post.$['dsq:id']} 解析成功`)
    } catch (e) {
      log(`${post.$['dsq:id']} 解析失败：${e.message}`)
    }
  }
  log(`解析成功 ${comments.length} 条评论`)
  const ids = await bulkSaveComments(comments)
  log(`导入成功 ${ids.length} 条评论`)
  return comments
}

function getRelativeUrl (url) {
  let x = url.indexOf('/')
  for (let i = 0; i < 2; i++) {
    x = url.indexOf('/', x + 1)
  }
  return url.substring(x)
}

// Artalk 导入
async function commentImportArtalk (artalkDb, log) {
  const comments = []
  if (!artalkDb || !artalkDb.length) {
    log('Artalk 评论文件格式有误')
    return
  }
  marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: true
  })
  log(`共 ${artalkDb.length} 条评论`)
  for (const comment of artalkDb) {
    try {
      const parsed = {
        _id: `artalk${comment.id}`,
        nick: comment.nick,
        ip: comment.ip,
        mail: comment.email,
        mailMd5: md5(comment.email),
        isSpam: false,
        ua: comment.ua || '',
        link: comment.link,
        pid: comment.rid ? `artalk${comment.rid}` : '',
        rid: comment.rid ? `artalk${comment.rid}` : '',
        master: false,
        comment: DOMPurify.sanitize(marked(comment.content)),
        url: getRelativeUrl(comment.page_key),
        href: comment.page_key,
        created: new Date(comment.date).getTime(),
        updated: Date.now()
      }
      comments.push(parsed)
      log(`${comment.id} 解析成功`)
    } catch (e) {
      log(`${comment.id} 解析失败：${e.message}`)
    }
  }
  log(`解析成功 ${comments.length} 条评论`)
  const ids = await bulkSaveComments(comments)
  log(`导入成功 ${ids.length} 条评论`)
  return comments
}

// 批量导入评论
async function bulkSaveComments (comments) {
  const batchRes = await db
    .collection('comment')
    .add(comments)
  return batchRes.ids
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
    await app.callFunction({
      name: 'twikoo',
      data: { event: 'POST_SUBMIT', comment }
    }, { timeout: 300 }) // 设置较短的 timeout 来实现异步
  } catch (e) {
    console.log('开始异步垃圾检测、发送评论通知')
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

// 异步垃圾检测、发送评论通知
async function postSubmit (comment, context) {
  if (!isRecursion(context)) return { code: RES_CODE.FORBIDDEN }
  // 垃圾检测
  await postCheckSpam(comment)
  // 发送通知
  await sendNotice(comment)
  return { code: RES_CODE.SUCCESS }
}

// 发送通知
async function sendNotice (comment) {
  if (comment.isSpam && config.NOTIFY_SPAM === 'false') return
  await Promise.all([
    noticeMaster(comment),
    noticeReply(comment),
    noticeWeChat(comment),
    noticePushPlus(comment),
    noticeQQ(comment)
  ]).catch(err => {
    console.error('邮件通知异常：', err)
  })
}

// 初始化邮件插件
async function initMailer () {
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
    transporter = nodemailer.createTransport(transportConfig)
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
  const IM_PUSH_CONFIGS = [
    'SC_SENDKEY',
    'QM_SENDKEY',
    'PUSH_PLUS_TOKEN'
  ]
  // 判断是否存在即时消息推送配置
  const hasIMPushConfig = IM_PUSH_CONFIGS.some(item => !!config[item])
  // 存在即时消息推送配置，则默认不发送邮件给博主
  if (hasIMPushConfig && config.SC_MAIL_NOTIFY !== 'true') return
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const COMMENT = comment.comment
  const SITE_URL = config.SITE_URL
  const POST_URL = appendHashToUrl(comment.href || SITE_URL + comment.url, comment.id)
  const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`
  let emailContent
  if (config.MAIL_TEMPLATE_ADMIN) {
    emailContent = config.MAIL_TEMPLATE_ADMIN
      .replace(/\${SITE_URL}/g, SITE_URL)
      .replace(/\${SITE_NAME}/g, SITE_NAME)
      .replace(/\${NICK}/g, NICK)
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
  const pushContent = getIMPushContent(comment)
  let scApiUrl = 'https://sc.ftqq.com'
  let scApiParam = {
    text: pushContent.subject,
    desp: pushContent.content
  }
  if (config.SC_SENDKEY.substring(0, 3).toLowerCase() === 'sct') {
    // 兼容 server 酱测试专版
    scApiUrl = 'https://sctapi.ftqq.com'
    scApiParam = {
      title: pushContent.subject,
      desp: pushContent.content
    }
  }
  const sendResult = await axios.post(`${scApiUrl}/${config.SC_SENDKEY}.send`, qs.stringify(scApiParam), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  console.log('微信通知结果：', sendResult)
}

// pushplus 通知
async function noticePushPlus (comment) {
  if (!config.PUSH_PLUS_TOKEN) {
    console.log('没有配置 pushplus，放弃通知')
    return
  }
  if (config.BLOGGER_EMAIL === comment.mail) return
  const pushContent = getIMPushContent(comment)
  const ppApiUrl = 'http://pushplus.hxtrip.com/send'
  const ppApiParam = {
    token: config.PUSH_PLUS_TOKEN,
    title: pushContent.subject,
    content: pushContent.content
  }
  const sendResult = await axios.post(ppApiUrl, ppApiParam)
  console.log('pushplus 通知结果：', sendResult)
}

// QQ通知
async function noticeQQ (comment) {
  if (!config.QM_SENDKEY) {
    console.log('没有配置 qmsg 酱，放弃QQ通知')
    return
  }
  if (config.BLOGGER_EMAIL === comment.mail) return
  const pushContent = getIMPushContent(comment)
  const qmApiUrl = 'https://qmsg.zendee.cn'
  const qmApiParam = {
    msg: pushContent.subject + '\n' + pushContent.content.replace(/<br>/g, '\n')
  }
  const sendResult = await axios.post(`${qmApiUrl}/send/${config.QM_SENDKEY}`, qs.stringify(qmApiParam), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  console.log('QQ通知结果：', sendResult)
}

// 即时消息推送内容获取
function getIMPushContent (comment) {
  const SITE_NAME = config.SITE_NAME
  const NICK = comment.nick
  const MAIL = comment.mail
  const IP = comment.ip
  const COMMENT = $(comment.comment).text()
  const SITE_URL = config.SITE_URL
  const POST_URL = appendHashToUrl(comment.href || SITE_URL + comment.url, comment.id)
  const subject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}有新评论了`
  const content = `评论人：${NICK}(${MAIL})<br>评论人IP：${IP}<br>评论内容：${COMMENT}<br>您可以点击 ${POST_URL} 查看回复的完整內容`
  return {
    subject,
    content
  }
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
  const POST_URL = appendHashToUrl(currentComment.href || config.SITE_URL + currentComment.url, currentComment.id)
  const SITE_URL = config.SITE_URL
  const emailSubject = config.MAIL_SUBJECT || `${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复`
  let emailContent
  if (config.MAIL_TEMPLATE) {
    emailContent = config.MAIL_TEMPLATE
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
  console.log('回复通知结果：', sendResult)
  return sendResult
}

function appendHashToUrl (url, hash) {
  if (url.indexOf('#') === -1) {
    return `${url}#${hash}`
  } else {
    return `${url.substring(0, url.indexOf('#'))}#${hash}`
  }
}

// 将评论转为数据库存储格式
async function parse (comment) {
  const timestamp = Date.now()
  const isAdminUser = await isAdmin()
  const isBloggerMail = comment.mail === config.BLOGGER_EMAIL
  if (isBloggerMail && !isAdminUser) throw new Error('请先登录管理面板，再使用博主身份发送评论')
  const commentDo = {
    uid: await getUid(),
    nick: comment.nick ? comment.nick : '匿名',
    mail: comment.mail ? comment.mail : '',
    mailMd5: comment.mail ? md5(comment.mail) : '',
    link: comment.link ? comment.link : '',
    ua: comment.ua,
    ip: auth.getClientIP(),
    master: isBloggerMail,
    url: comment.url,
    href: comment.href,
    comment: DOMPurify.sanitize(comment.comment, { FORBID_TAGS: ['style'], FORBID_ATTR: ['style'] }),
    pid: comment.pid ? comment.pid : comment.rid,
    rid: comment.rid,
    isSpam: isAdminUser ? false : preCheckSpam(comment.comment),
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
  const limitPerMinute = parseInt(config.LIMIT_PER_MINUTE)
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
}

// 预垃圾评论检测
function preCheckSpam (comment) {
  if (config.AKISMET_KEY === 'MANUAL_REVIEW') {
    // 人工审核
    console.log('已使用人工审核模式，评论审核后才会发表~')
    return true
  } else if (config.FORBIDDEN_WORDS) {
    // 违禁词检测
    for (const forbiddenWord of config.FORBIDDEN_WORDS.split(',')) {
      if (comment.indexOf(forbiddenWord.trim()) !== -1) {
        console.log('包含违禁词，直接标记为垃圾评论~')
        return true
      }
    }
  }
  return false
}

// 后垃圾评论检测
async function postCheckSpam (comment) {
  try {
    let isSpam
    if (comment.isSpam) {
      // 预检测没过的，就不再检测了
      isSpam = true
    } else if (config.QCLOUD_SECRET_ID && config.QCLOUD_SECRET_KEY) {
      // 腾讯云内容安全
      const client = new tencentcloud.tms.v20200713.Client({
        credential: { secretId: config.QCLOUD_SECRET_ID, secretKey: config.QCLOUD_SECRET_KEY },
        region: 'ap-shanghai',
        profile: { httpProfile: { endpoint: 'tms.tencentcloudapi.com' } }
      })
      const checkResult = await client.TextModeration({
        Content: CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(comment.comment)),
        Device: { IP: comment.ip },
        User: { Nickname: comment.nick }
      })
      console.log('腾讯云返回结果：', checkResult)
      isSpam = checkResult.EvilFlag !== 0
    } else if (config.AKISMET_KEY) {
      // Akismet
      const akismetClient = new AkismetClient({
        key: config.AKISMET_KEY,
        blog: config.SITE_URL
      })
      const isValid = await akismetClient.verifyKey()
      if (!isValid) {
        console.log('Akismet key 不可用：', config.AKISMET_KEY)
        return
      }
      isSpam = await akismetClient.checkSpam({
        user_ip: comment.ip,
        user_agent: comment.ua,
        permalink: comment.href,
        comment_type: comment.rid ? 'reply' : 'comment',
        comment_author: comment.nick,
        comment_author_email: comment.mail,
        comment_author_url: comment.link,
        comment_content: comment.comment
      })
    }
    console.log('垃圾评论检测结果：', isSpam)
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
  } catch (err) {
    console.error('垃圾评论检测异常：', err)
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

function getUrlsQuery (urls) {
  const query = []
  for (const url of urls) {
    if (url) query.push(...getUrlQuery(url))
  }
  return query
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
        avatar: getAvatar(comment),
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

function getAvatar (comment) {
  if (comment.avatar) {
    return comment.avatar
  } else {
    const gravatarCdn = config.GRAVATAR_CDN || 'cn.gravatar.com'
    const defaultGravatar = config.DEFAULT_GRAVATAR || 'identicon'
    const mailMd5 = comment.mailMd5 || md5(comment.mail)
    return `https://${gravatarCdn}/avatar/${mailMd5}?d=${defaultGravatar}`
  }
}

function isQQ (mail) {
  return /^[1-9][0-9]{4,10}$/.test(mail) ||
    /^[1-9][0-9]{4,10}@qq.com$/i.test(mail)
}

function addQQMailSuffix (mail) {
  if (/^[1-9][0-9]{4,10}$/.test(mail)) return `${mail}@qq.com`
  else return mail
}

async function getQQAvatar (qq) {
  try {
    const qqNum = qq.replace(/@qq.com/ig, '')
    const result = await axios.get(`https://ptlogin2.qq.com/getface?imgtype=4&uin=${qqNum}`)
    if (result && result.data) {
      const start = result.data.indexOf('http')
      const end = result.data.indexOf('"', start)
      if (start === -1 || end === -1) return null
      return result.data.substring(start, end)
    }
  } catch (e) {
    console.error('获取 QQ 头像失败：', e)
  }
}

function getConfig () {
  return {
    code: RES_CODE.SUCCESS,
    config: {
      VERSION,
      SITE_NAME: config.SITE_NAME,
      SITE_URL: config.SITE_URL,
      MASTER_TAG: config.MASTER_TAG,
      COMMENT_BG_IMG: config.COMMENT_BG_IMG,
      GRAVATAR_CDN: config.GRAVATAR_CDN,
      DEFAULT_GRAVATAR: config.DEFAULT_GRAVATAR,
      SHOW_IMAGE: config.SHOW_IMAGE || 'true',
      IMAGE_CDN: config.IMAGE_CDN,
      SHOW_EMOTION: config.SHOW_EMOTION || 'true',
      EMOTION_CDN: config.EMOTION_CDN,
      COMMENT_PLACEHOLDER: config.COMMENT_PLACEHOLDER,
      REQUIRED_FIELDS: config.REQUIRED_FIELDS,
      HIDE_ADMIN_CRYPT: config.HIDE_ADMIN_CRYPT,
      HIGHLIGHT: config.HIGHLIGHT || 'true',
      HIGHLIGHT_THEME: config.HIGHLIGHT_THEME
    }
  }
}

async function getConfigForAdmin () {
  const isAdminUser = await isAdmin()
  if (isAdminUser) {
    delete config.CREDENTIALS
    return {
      code: RES_CODE.SUCCESS,
      config
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
    config = res.data[0] || {}
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
  console.log('写入配置：', newConfig)
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
    console.error('写入配置失败：', e)
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
      console.error('建立数据库失败：', e)
    }
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

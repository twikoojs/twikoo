/*!
 * Twikoo EdgeOne Pages Node Function
 * (c) 2020-present iMaeGoo
 * Released under the MIT License.
 * 
 * 使用 twikoo-func 实现核心逻辑，通过 Edge Function 操作 KV 数据库
 */

import { v4 as uuidv4 } from 'uuid'
import xss from 'xss'
import bowser from 'bowser'
import {
  getMd5,
  getSha256,
  getXml2js,
  setCustomLibs
} from 'twikoo-func/utils/lib'
import { getIpRegion } from './ip2region-searcher.js'
import {
  getFuncVersion,
  getUrlQuery,
  getUrlsQuery,
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
} from 'twikoo-func/utils'
import {
  jsonParse,
  commentImportValine,
  commentImportDisqus,
  commentImportArtalk,
  commentImportArtalk2,
  commentImportTwikoo
} from 'twikoo-func/utils/import'
import { postCheckSpam } from 'twikoo-func/utils/spam'
import { sendNotice, emailTest } from 'twikoo-func/utils/notify'
import { uploadImage } from 'twikoo-func/utils/image'
import logger from 'twikoo-func/utils/logger'
import constants from 'twikoo-func/utils/constants'

const { RES_CODE, MAX_REQUEST_TIMES } = constants
const VERSION = '1.6.44'

// 注入自定义依赖（对标 Cloudflare 版本）
setCustomLibs({
  DOMPurify: {
    sanitize(input) {
      return input
    }
  },
  nodemailer: {
    createTransport(mailConfig) {
      return {
        verify() {
          if (!mailConfig.service || (mailConfig.service.toLowerCase() !== 'sendgrid' && mailConfig.service.toLowerCase() !== 'mailchannels')) {
            throw new Error('仅支持 SendGrid 和 MailChannels 邮件服务。')
          }
          if (!mailConfig.auth || !mailConfig.auth.user) {
            throw new Error('需要在 SMTP_USER 中配置账户名，如果邮件服务不需要可随意填写。')
          }
          if (!mailConfig.auth || !mailConfig.auth.pass) {
            throw new Error('需要在 SMTP_PASS 中配置 API 令牌。')
          }
          return true
        },
        sendMail({ from, to, subject, html }) {
          if (mailConfig.service.toLowerCase() === 'sendgrid') {
            return fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mailConfig.auth.pass}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: from },
                subject,
                content: [{ type: 'text/html', value: html }],
              })
            })
          } else if (mailConfig.service.toLowerCase() === 'mailchannels') {
            return fetch('https://api.mailchannels.net/tx/v1/send', {
              method: 'POST',
              headers: {
                'X-Api-Key': mailConfig.auth.pass,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: from },
                subject,
                content: [{ type: 'text/html', value: html }],
              })
            })
          }
        }
      }
    }
  }
})

const md5 = getMd5()
const sha256 = getSha256()
const xml2js = getXml2js()

// ==================== 本地实现的 parseComment（替代 twikoo-func 版本）====================

/**
 * 修复 OS 版本名称
 */
function fixOS(ua) {
  const os = ua.getOS()
  if (!os.versionName) {
    if (os.name === 'Windows' && os.version === 'NT 11.0') {
      os.versionName = '11'
    } else if (os.name === 'macOS') {
      const majorPlatformVersion = os.version?.split('.')[0]
      os.versionName = {
        11: 'Big Sur', 12: 'Monterey', 13: 'Ventura', 14: 'Sonoma', 15: 'Sequoia'
      }[majorPlatformVersion]
    } else if (os.name === 'Android') {
      const majorPlatformVersion = os.version?.split('.')[0]
      os.versionName = {
        10: 'Quince Tart', 11: 'Red Velvet Cake', 12: 'Snow Cone',
        13: 'Tiramisu', 14: 'Upside Down Cake', 15: 'Vanilla Ice Cream', 16: 'Baklava'
      }[majorPlatformVersion]
    } else if (ua.test(/harmony/i)) {
      os.name = 'Harmony'
      const match = ua.getUA().match(/harmony[\s/-](\d+(\.\d+)*)/i)
      os.version = (match && match[1]) || ''
      os.versionName = ''
    }
  }
  return os
}

/**
 * 获取回复人昵称
 */
function getRuser(pid, comments = []) {
  const comment = comments.find((item) => item._id === pid)
  return comment ? comment.nick : null
}

/**
 * 将评论记录转换为前端需要的格式（使用本地 IP 归属地查询）
 */
function toCommentDto(comment, uid, replies = [], comments = [], cfg) {
  let displayOs = ''
  let displayBrowser = ''
  if (cfg.SHOW_UA !== 'false') {
    try {
      const ua = bowser.getParser(comment.ua)
      const os = fixOS(ua)
      displayOs = [os.name, os.versionName ? os.versionName : os.version].join(' ')
      displayBrowser = [ua.getBrowserName(), ua.getBrowserVersion()].join(' ')
    } catch (e) {
      logger.warn('bowser 错误：', e)
    }
  }
  const showRegion = !!cfg.SHOW_REGION && cfg.SHOW_REGION !== 'false'
  return {
    id: comment._id.toString(),
    nick: comment.nick,
    avatar: comment.avatar,
    mailMd5: getMailMd5(comment),
    link: comment.link,
    comment: comment.comment,
    os: displayOs,
    browser: displayBrowser,
    ipRegion: showRegion ? getIpRegion(comment.ip, false) : '',
    master: comment.master,
    like: comment.like ? comment.like.length : 0,
    liked: comment.like ? comment.like.findIndex((item) => item === uid) > -1 : false,
    replies: replies,
    rid: comment.rid,
    pid: comment.pid,
    ruser: getRuser(comment.pid, comments),
    top: comment.top,
    isSpam: comment.isSpam,
    created: comment.created,
    updated: comment.updated
  }
}

/**
 * 筛除隐私字段，拼接回复列表（本地实现，使用自己的 IP 归属地查询）
 */
function parseComment(comments, uid, cfg) {
  const result = []
  for (const comment of comments) {
    if (!comment.rid) {
      const replies = comments
        .filter((item) => item.rid === comment._id.toString())
        .map((item) => toCommentDto(item, uid, [], comments, cfg))
        .sort((a, b) => a.created - b.created)
      result.push(toCommentDto(comment, uid, replies, [], cfg))
    }
  }
  return result
}

/**
 * 为管理后台解析评论
 */
function parseCommentForAdmin(comments) {
  for (const comment of comments) {
    comment.ipRegion = getIpRegion(comment.ip, true)
  }
  return comments
}

// 全局变量
let config = null
const requestTimes = {}



// ==================== 工具函数 ====================

function getAllowedOrigin(req) {
  const origin = req.headers.origin
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/
  if (localhostRegex.test(origin)) {
    return origin
  } else if (config && config.CORS_ALLOW_ORIGIN) {
    const corsList = config.CORS_ALLOW_ORIGIN.split(',')
    for (const cors of corsList) {
      if (cors.replace(/\/$/, '') === origin) {
        return origin
      }
    }
    return ''
  }
  return origin
}

// 获取 IP（优先使用 EdgeOne 提供的 eo-connecting-ip）
function getIp(req) {
  return req.headers['eo-connecting-ip'] ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.ip ||
         'unknown'
}

function protect(ip) {
  requestTimes[ip] = (requestTimes[ip] || 0) + 1
  if (requestTimes[ip] > MAX_REQUEST_TIMES) {
    logger.warn(`${ip} 当前请求次数为 ${requestTimes[ip]}，已超过最大请求次数`)
    throw new Error('Too Many Requests')
  }
  logger.log(`${ip} 当前请求次数为 ${requestTimes[ip]}`)
}

// 定期清理请求计数
setInterval(() => {
  Object.keys(requestTimes).forEach(key => delete requestTimes[key])
}, 10 * 60 * 1000)

// ==================== KV 代理层 ====================

function createKVProxy(req) {
  // 使用 eo-pages-host（EdgeOne Pages 提供的原始域名）
  const host = req.headers['eo-pages-host'] || req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${protocol}://${host}`
  
  async function callKV(action, data) {
    const kvUrl = `${baseUrl}/api/kv`
    
    try {
      const response = await fetch(kvUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Twikoo-Internal': 'true'
        },
        body: JSON.stringify({ action, data })
      })
      
      const text = await response.text()
      
      let result
      try {
        result = JSON.parse(text)
      } catch (e) {
        logger.error('[KV] JSON 解析失败:', text.substring(0, 200))
        throw new Error(`KV API 返回非 JSON: ${text.substring(0, 200)}`)
      }
      
      if (result.code !== 0) {
        throw new Error(result.message || 'KV 操作失败')
      }
      
      return result.data
    } catch (e) {
      logger.error('[KV] 调用异常:', e.message)
      throw e
    }
  }
  
  return {
    async getComments(query = {}) {
      return callKV('getComments', { query })
    },
    async countComments(query = {}) {
      const comments = await this.getComments(query)
      return comments.length
    },
    async addComment(comment) {
      return callKV('addComment', { comment })
    },
    async updateComment(id, updates) {
      return callKV('updateComment', { id, updates })
    },
    async deleteComment(id) {
      return callKV('deleteComment', { id })
    },
    async getComment(id) {
      return callKV('getComment', { id })
    },
    async bulkAddComments(comments) {
      return callKV('bulkAddComments', { comments })
    },
    async getConfig() {
      return callKV('getConfig', {})
    },
    async saveConfig(newConfig) {
      return callKV('saveConfig', { config: newConfig })
    },
    async getCounter(url) {
      return callKV('getCounter', { url })
    },
    async incCounter(url, title) {
      return callKV('incCounter', { url, title })
    }
  }
}

// ==================== 配置管理 ====================

async function readConfig(req) {
  try {
    const db = createKVProxy(req)
    config = await db.getConfig()
  } catch (e) {
    logger.error('读取配置失败:', e.message)
    config = {}
  }
  return config
}

async function writeConfig(db, newConfig) {
  if (!Object.keys(newConfig).length) return 0
  logger.info('写入配置')
  await db.saveConfig(newConfig)
  config = null
  return 1
}

function isAdmin(accessToken) {
  return config && config.ADMIN_PASS === md5(accessToken)
}

// ==================== 密码管理 ====================

async function setPassword(event, db, accessToken) {
  const isAdminUser = isAdmin(accessToken)
  if (config.ADMIN_PASS && !isAdminUser) {
    return { code: RES_CODE.PASS_EXIST, message: '请先登录再修改密码' }
  }
  const ADMIN_PASS = md5(event.password)
  await writeConfig(db, { ADMIN_PASS })
  return { code: RES_CODE.SUCCESS }
}

async function login(password) {
  if (!config) {
    return { code: RES_CODE.CONFIG_NOT_EXIST, message: '数据库无配置' }
  }
  if (!config.ADMIN_PASS) {
    return { code: RES_CODE.PASS_NOT_EXIST, message: '未配置管理密码' }
  }
  if (config.ADMIN_PASS !== md5(password)) {
    return { code: RES_CODE.PASS_NOT_MATCH, message: '密码错误' }
  }
  return { code: RES_CODE.SUCCESS }
}

// ==================== 评论读取 ====================

async function commentGet(event, db, accessToken) {
  const res = {}
  try {
    validate(event, ['url'])
    const uid = accessToken
    const isAdminUser = isAdmin(accessToken)
    const limit = parseInt(config.COMMENT_PAGE_SIZE) || 8
    let more = false
    
    const urlQuery = getUrlQuery(event.url)
    
    // 获取所有评论
    let allComments = await db.getComments()
    
    // 过滤主楼评论
    let mainComments = allComments.filter(c => 
      urlQuery.includes(c.url) && 
      (!c.rid || c.rid === '') &&
      (c.isSpam !== true || c.uid === uid || isAdminUser)
    )
    
    // 计算总数
    const count = mainComments.length
    
    // 排序
    mainComments.sort((a, b) => b.created - a.created)
    
    // 处理置顶和分页
    let top = []
    if (!config.TOP_DISABLED && !event.before) {
      top = mainComments.filter(c => c.top === true)
      mainComments = mainComments.filter(c => c.top !== true)
    }
    
    // 分页
    if (event.before) {
      mainComments = mainComments.filter(c => c.created < event.before)
    }
    
    if (mainComments.length > limit) {
      more = true
      mainComments = mainComments.slice(0, limit)
    }
    
    // 合并置顶
    mainComments = [...top, ...mainComments]
    
    // 获取回复
    const mainIds = mainComments.map(c => c._id)
    const replies = allComments.filter(c => 
      mainIds.includes(c.rid) &&
      (c.isSpam !== true || c.uid === uid || isAdminUser)
    )
    
    res.data = parseComment([...mainComments, ...replies], uid, config)
    res.more = more
    res.count = count
  } catch (e) {
    res.data = []
    res.message = e.message
  }
  return res
}

// ==================== 管理员评论操作 ====================

async function commentGetForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    validate(event, ['per', 'page'])
    
    let comments = await db.getComments()
    
    if (event.type === 'VISIBLE') {
      comments = comments.filter(c => c.isSpam !== true)
    } else if (event.type === 'HIDDEN') {
      comments = comments.filter(c => c.isSpam === true)
    }
    
    if (event.keyword) {
      const keyword = event.keyword.toLowerCase()
      comments = comments.filter(c => 
        (c.nick && c.nick.toLowerCase().includes(keyword)) ||
        (c.mail && c.mail.toLowerCase().includes(keyword)) ||
        (c.link && c.link.toLowerCase().includes(keyword)) ||
        (c.ip && c.ip.toLowerCase().includes(keyword)) ||
        (c.comment && c.comment.toLowerCase().includes(keyword)) ||
        (c.url && c.url.toLowerCase().includes(keyword)) ||
        (c.href && c.href.toLowerCase().includes(keyword))
      )
    }
    
    comments.sort((a, b) => b.created - a.created)
    
    const count = comments.length
    const start = event.per * (event.page - 1)
    const data = comments.slice(start, start + event.per)
    
    res.code = RES_CODE.SUCCESS
    res.count = count
    res.data = parseCommentForAdmin(data)
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentSetForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    validate(event, ['id', 'set'])
    await db.updateComment(event.id, {
      ...event.set,
      updated: Date.now()
    })
    res.code = RES_CODE.SUCCESS
    res.updated = 1
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentDeleteForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    validate(event, ['id'])
    await db.deleteComment(event.id)
    res.code = RES_CODE.SUCCESS
    res.deleted = 1
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function commentImportForAdmin(event, db, accessToken) {
  const res = {}
  let logText = ''
  const log = (message) => {
    logText += `${new Date().toLocaleString()} ${message}\n`
  }
  const isAdminUser = isAdmin(accessToken)
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
      await db.bulkAddComments(comments)
      log('导入成功')
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

async function commentExportForAdmin(event, db, accessToken) {
  const res = {}
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    const data = await db.getComments()
    res.code = RES_CODE.SUCCESS
    res.data = data
  } else {
    res.code = RES_CODE.NEED_LOGIN
    res.message = '请先登录'
  }
  return res
}

async function readFile(file, type, log) {
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

// ==================== 点赞 ====================

async function commentLike(event, db, accessToken) {
  const res = {}
  validate(event, ['id'])
  const uid = accessToken
  const comment = await db.getComment(event.id)
  
  if (comment) {
    let likes = comment.like || []
    const index = likes.indexOf(uid)
    if (index === -1) {
      likes.push(uid)
    } else {
      likes.splice(index, 1)
    }
    await db.updateComment(event.id, { like: likes })
    res.updated = 1
  } else {
    res.updated = 0
  }
  return res
}

// ==================== 评论提交 ====================

async function commentSubmit(event, req, db, accessToken) {
  const res = {}
  validate(event, ['url', 'ua', 'comment'])
  
  const ip = getIp(req)
  
  // 限流检查
  await limitFilter(db, ip)
  
  // 验证码检查
  await checkCaptcha(event, ip)
  
  // 解析评论数据
  const data = await parseCommentData(event, req, accessToken, ip)
  
  // 保存评论
  const result = await db.addComment(data)
  data.id = result.id
  data._id = result.id
  res.id = result.id
  
  // 异步处理垃圾检测和通知
  postSubmit(data, db).catch(e => {
    logger.error('POST_SUBMIT 失败', e.message)
  })
  
  return res
}

async function parseCommentData(event, req, accessToken, ip) {
  const timestamp = Date.now()
  const isAdminUser = isAdmin(accessToken)
  const isBloggerMail = equalsMail(config.BLOGGER_EMAIL, event.mail)
  
  if (isBloggerMail && !isAdminUser) {
    throw new Error('请先登录管理面板，再使用博主身份发送评论')
  }
  
  const hashMethod = config.GRAVATAR_CDN === 'cravatar.cn' ? md5 : sha256
  
  const commentDo = {
    _id: uuidv4().replace(/-/g, ''),
    uid: accessToken,
    nick: event.nick ? event.nick : '匿名',
    mail: event.mail ? event.mail : '',
    mailMd5: event.mail ? hashMethod(normalizeMail(event.mail)) : '',
    link: event.link ? event.link : '',
    ua: event.ua,
    ip: ip,
    master: isBloggerMail,
    url: event.url,
    href: event.href,
    comment: xss(event.comment),
    pid: event.pid ? event.pid : event.rid,
    rid: event.rid,
    isSpam: isAdminUser ? false : preCheckSpam(event, config),
    created: timestamp,
    updated: timestamp
  }
  
  // 处理 QQ 邮箱和头像
  if (isQQ(event.mail)) {
    commentDo.mail = addQQMailSuffix(event.mail)
    commentDo.mailMd5 = md5(normalizeMail(commentDo.mail))
    try {
      commentDo.avatar = await getQQAvatar(event.mail)
    } catch (e) {
      logger.warn('获取 QQ 头像失败：', e.message)
    }
  }
  
  return commentDo
}

async function postSubmit(comment, db) {
  try {
    logger.log('POST_SUBMIT')
    
    // 获取父评论
    const getParentComment = async (c) => {
      if (c.pid) {
        return db.getComment(c.pid)
      }
      return null
    }
    
    // 垃圾检测
    const isSpam = await postCheckSpam(comment, config)
    if (isSpam && !comment.isSpam) {
      await db.updateComment(comment._id, { isSpam: true, updated: Date.now() })
      comment.isSpam = isSpam
    }
    
    // 发送通知
    await sendNotice(comment, config, getParentComment)
  } catch (e) {
    logger.warn('POST_SUBMIT 失败', e)
  }
}

async function limitFilter(db, ip) {
  let limitPerMinute = parseInt(config.LIMIT_PER_MINUTE)
  if (Number.isNaN(limitPerMinute)) limitPerMinute = 10
  
  if (limitPerMinute) {
    const comments = await db.getComments()
    const recentComments = comments.filter(c => 
      c.ip === ip && c.created > Date.now() - 600000
    )
    if (recentComments.length > limitPerMinute) {
      throw new Error('发言频率过高')
    }
  }
  
  let limitPerMinuteAll = parseInt(config.LIMIT_PER_MINUTE_ALL)
  if (Number.isNaN(limitPerMinuteAll)) limitPerMinuteAll = 10
  
  if (limitPerMinuteAll) {
    const comments = await db.getComments()
    const recentComments = comments.filter(c => c.created > Date.now() - 600000)
    if (recentComments.length > limitPerMinuteAll) {
      throw new Error('评论太火爆啦 >_< 请稍后再试')
    }
  }
}

async function checkCaptcha(event, ip) {
  if (config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY) {
    await checkTurnstileCaptcha({
      ip: ip,
      turnstileToken: event.turnstileToken,
      turnstileTokenSecretKey: config.TURNSTILE_SECRET_KEY
    })
  }
}

// ==================== 配置操作 ====================

async function setConfig(event, db, accessToken) {
  const isAdminUser = isAdmin(accessToken)
  if (isAdminUser) {
    await writeConfig(db, event.config)
    return { code: RES_CODE.SUCCESS }
  } else {
    return { code: RES_CODE.NEED_LOGIN, message: '请先登录' }
  }
}

// ==================== 计数器 ====================

async function counterGet(event, db) {
  const res = {}
  try {
    validate(event, ['url'])
    const record = await db.getCounter(event.url)
    res.data = record || {}
    res.time = res.data.time || 0
    res.updated = await db.incCounter(event.url, event.title)
  } catch (e) {
    res.message = e.message
  }
  return res
}

// ==================== 评论统计 ====================

async function getCommentsCount(event, db) {
  const res = {}
  try {
    validate(event, ['urls'])
    const comments = await db.getComments()
    
    res.data = []
    for (const url of event.urls) {
      const urlVariants = getUrlQuery(url)
      const count = comments.filter(c => 
        urlVariants.includes(c.url) &&
        c.isSpam !== true &&
        (event.includeReply || !c.rid || c.rid === '')
      ).length
      res.data.push({ url, count })
    }
  } catch (e) {
    res.message = e.message
  }
  return res
}

async function getRecentComments(event, db) {
  const res = {}
  try {
    let comments = await db.getComments()
    
    comments = comments.filter(c => c.isSpam !== true)
    
    if (event.urls && event.urls.length) {
      const urlsQuery = getUrlsQuery(event.urls)
      comments = comments.filter(c => urlsQuery.includes(c.url))
    }
    
    if (!event.includeReply) {
      comments = comments.filter(c => !c.rid || c.rid === '')
    }
    
    comments.sort((a, b) => b.created - a.created)
    
    const pageSize = Math.min(event.pageSize || 10, 100)
    comments = comments.slice(0, pageSize)
    
    res.data = comments.map(comment => ({
      id: comment._id,
      url: comment.url,
      nick: comment.nick,
      avatar: getAvatar(comment, config),
      mailMd5: getMailMd5(comment),
      link: comment.link,
      comment: comment.comment,
      commentText: comment.comment.replace(/<[^>]*>/g, ''),
      created: comment.created
    }))
  } catch (e) {
    res.message = e.message
  }
  return res
}

// EdgeOne Pages Node Function 入口
export async function onRequest(context) {
  const { request } = context
  
  // 将 EdgeOne 请求转换为 Express 可处理的格式
  return new Promise(async (resolve) => {
    try {
      const url = new URL(request.url)
      const method = request.method
      
      // 构造模拟的 req 对象
      const headers = {}
      request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
      })
      
      let body = null
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        try {
          body = await request.json()
        } catch (e) {
          body = {}
        }
      }
      
      const req = {
        method,
        url: url.pathname + url.search,
        path: url.pathname,
        headers,
        body,
        ip: headers['x-real-ip'] || headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown',
        protocol: url.protocol.replace(':', ''),
        get: (name) => headers[name.toLowerCase()]
      }
      
      // 构造模拟的 res 对象
      let statusCode = 200
      const resHeaders = {}
      let resBody = null
      
      const res = {
        status: (code) => { statusCode = code; return res },
        setHeader: (name, value) => { resHeaders[name] = value },
        set: (name, value) => { resHeaders[name] = value },
        json: (data) => {
          resHeaders['Content-Type'] = 'application/json'
          resBody = JSON.stringify(data)
          finish()
        },
        send: (data) => {
          resBody = data
          finish()
        },
        end: () => finish()
      }
      
      function finish() {
        resolve(new Response(resBody, {
          status: statusCode,
          headers: resHeaders
        }))
      }
      
      // 手动处理路由
      console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`)
      
      // CORS 处理
      const origin = headers.origin
      if (origin) {
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')
        res.setHeader('Access-Control-Max-Age', '600')
      }
      
      if (method === 'OPTIONS') {
        res.status(204).end()
        return
      }
      
      if (method === 'GET') {
        res.json({
          code: RES_CODE.SUCCESS,
          message: 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置',
          version: VERSION
        })
        return
      }
      
      if (method === 'POST') {
        // 调用主处理逻辑
        await handlePost(req, res)
        return
      }
      
      res.status(404).json({ code: 404, message: 'Not Found' })
    } catch (e) {
      console.error('onRequest error:', e)
      resolve(new Response(JSON.stringify({ code: 500, message: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
  })
}

// POST 请求处理主逻辑
async function handlePost(req, res) {
  let accessToken
  const event = req.body || {}
  const ip = getIp(req)
  
  logger.log('请求 IP：', ip)
  logger.log('请求函数：', event.event)
  logger.log('请求参数：', event)
  
  let result = {}
  
  try {
    // 防护
    protect(ip)
    
    // 生成或使用 accessToken
    accessToken = event.accessToken || uuidv4().replace(/-/g, '')
    
    // 读取配置
    await readConfig(req)
    
    // 创建数据库操作对象
    const db = createKVProxy(req)
    
    switch (event.event) {
      case 'GET_FUNC_VERSION':
        result = getFuncVersion({ VERSION })
        break
      case 'COMMENT_GET':
        result = await commentGet(event, db, accessToken)
        break
      case 'COMMENT_GET_FOR_ADMIN':
        result = await commentGetForAdmin(event, db, accessToken)
        break
      case 'COMMENT_SET_FOR_ADMIN':
        result = await commentSetForAdmin(event, db, accessToken)
        break
      case 'COMMENT_DELETE_FOR_ADMIN':
        result = await commentDeleteForAdmin(event, db, accessToken)
        break
      case 'COMMENT_IMPORT_FOR_ADMIN':
        result = await commentImportForAdmin(event, db, accessToken)
        break
      case 'COMMENT_LIKE':
        result = await commentLike(event, db, accessToken)
        break
      case 'COMMENT_SUBMIT':
        result = await commentSubmit(event, req, db, accessToken)
        break
      case 'COUNTER_GET':
        result = await counterGet(event, db)
        break
      case 'GET_PASSWORD_STATUS':
        result = await getPasswordStatus(config, VERSION)
        break
      case 'SET_PASSWORD':
        result = await setPassword(event, db, accessToken)
        break
      case 'GET_CONFIG':
        result = await getConfig({ config, VERSION, isAdmin: isAdmin(accessToken) })
        break
      case 'GET_CONFIG_FOR_ADMIN':
        result = await getConfigForAdmin({ config, isAdmin: isAdmin(accessToken) })
        break
      case 'SET_CONFIG':
        result = await setConfig(event, db, accessToken)
        break
      case 'LOGIN':
        result = await login(event.password)
        break
      case 'GET_COMMENTS_COUNT':
        result = await getCommentsCount(event, db)
        break
      case 'GET_RECENT_COMMENTS':
        result = await getRecentComments(event, db)
        break
      case 'EMAIL_TEST':
        result = await emailTest(event, config, isAdmin(accessToken))
        break
      case 'UPLOAD_IMAGE':
        result = await uploadImage(event, config)
        break
      case 'COMMENT_EXPORT_FOR_ADMIN':
        result = await commentExportForAdmin(event, db, accessToken)
        break
      default:
        if (event.event) {
          result.code = RES_CODE.EVENT_NOT_EXIST
          result.message = '请更新 Twikoo 云函数至最新版本'
        } else {
          result.code = RES_CODE.NO_PARAM
          result.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置'
          result.version = VERSION
        }
    }
    
    if (!result.code && !event.accessToken) {
      result.accessToken = accessToken
    }
  } catch (e) {
    logger.error('Twikoo 遇到错误：', e.message, e.stack)
    result.code = RES_CODE.FAIL
    result.message = e.message
  }
  
  logger.log('请求返回：', result)
  res.json(result)
}

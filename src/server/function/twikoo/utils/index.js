const { URL } = require('url')
const {
  getAxios,
  getFormData,
  getBowser,
  getIpToRegion,
  getMd5,
  getSha256
} = require('./lib')
const axios = getAxios()
const FormData = getFormData()
const bowser = getBowser()
const md5 = getMd5()
const sha256 = getSha256()
const { RES_CODE } = require('./constants')
const logger = require('./logger')

let ipRegionSearcher

// IP 属地查询
function getIpRegionSearcher () {
  if (!ipRegionSearcher) {
    const ipToRegion = getIpToRegion()
    ipRegionSearcher = ipToRegion.create() // 初始化 IP 属地
  }
  return ipRegionSearcher
}

const fn = {
  // 获取 Twikoo 云函数版本
  getFuncVersion (VERSION) {
    return {
      code: RES_CODE.SUCCESS,
      version: VERSION
    }
  },
  // 同时查询 /path 和 /path/ 的评论
  getUrlQuery (url) {
    const variantUrl = url[url.length - 1] === '/' ? url.substring(0, url.length - 1) : `${url}/`
    return [url, variantUrl]
  },
  getUrlsQuery (urls) {
    const query = []
    for (const url of urls) {
      if (url) query.push(...fn.getUrlQuery(url))
    }
    return query
  },
  // 筛除隐私字段，拼接回复列表
  parseComment (comments, uid, config) {
    const result = []
    for (const comment of comments) {
      if (!comment.rid) {
        const replies = comments
          .filter((item) => item.rid === comment._id.toString())
          .map((item) => fn.toCommentDto(item, uid, [], comments, config))
          .sort((a, b) => a.created - b.created)
        result.push(fn.toCommentDto(comment, uid, replies, [], config))
      }
    }
    return result
  },
  // 将评论记录转换为前端需要的格式
  toCommentDto (comment, uid, replies = [], comments = [], config) {
    let displayOs = ''
    let displayBrowser = ''
    if (config.SHOW_UA !== 'false') {
      try {
        const ua = bowser.getParser(comment.ua)
        const os = fn.fixOS(ua)
        displayOs = [os.name, os.versionName ? os.versionName : os.version].join(' ')
        displayBrowser = [ua.getBrowserName(), ua.getBrowserVersion()].join(' ')
      } catch (e) {
        logger.warn('bowser 错误：', e)
      }
    }
    const showRegion = !!config.SHOW_REGION && config.SHOW_REGION !== 'false'
    return {
      id: comment._id.toString(),
      nick: comment.nick,
      avatar: comment.avatar,
      mailMd5: fn.getMailMd5(comment),
      link: comment.link,
      comment: comment.comment,
      os: displayOs,
      browser: displayBrowser,
      ipRegion: showRegion ? fn.getIpRegion({ ip: comment.ip }) : '',
      master: comment.master,
      like: comment.like ? comment.like.length : 0,
      liked: comment.like ? comment.like.findIndex((item) => item === uid) > -1 : false,
      replies: replies,
      rid: comment.rid,
      pid: comment.pid,
      ruser: fn.ruser(comment.pid, comments),
      top: comment.top,
      isSpam: comment.isSpam,
      created: comment.created,
      updated: comment.updated
    }
  },
  fixOS (ua) {
    const os = ua.getOS()
    if (!os.versionName) {
      // fix version name of Win 11 & macOS ^11 & Android ^10
      if (os.name === 'Windows' && os.version === 'NT 11.0') {
        os.versionName = '11'
      } else if (os.name === 'macOS') {
        const majorPlatformVersion = os.version.split('.')[0]
        os.versionName = {
          11: 'Big Sur',
          12: 'Monterey',
          13: 'Ventura',
          14: 'Sonoma',
          15: 'Sequoia',
          16: 'Tahoe'
        }[majorPlatformVersion]
      } else if (os.name === 'Android') {
        const majorPlatformVersion = os.version.split('.')[0]
        os.versionName = {
          10: 'Quince Tart',
          11: 'Red Velvet Cake',
          12: 'Snow Cone',
          13: 'Tiramisu',
          14: 'Upside Down Cake',
          15: 'Vanilla Ice Cream',
          16: 'Baklava'
        }[majorPlatformVersion]
      } else if (ua.test(/harmony/i)) {
        os.name = 'Harmony'
        os.version = fn.getFirstMatch(/harmony[\s/-](\d+(\.\d+)*)/i, ua.getUA())
        os.versionName = ''
      }
    }
    return os
  },
  /**
   * Get first matched item for a string
   * @param {RegExp} regexp
   * @param {String} ua
   * @return {Array|{index: number, input: string}|*|boolean|string}
   */
  getFirstMatch (regexp, ua) {
    const match = ua.match(regexp)
    return (match && match.length > 0 && match[1]) || ''
  },
  // 获取回复人昵称 / Get replied user nick name
  ruser (pid, comments = []) {
    const comment = comments.find((item) => item._id === pid)
    return comment ? comment.nick : null
  },
  /**
   * 获取 IP 属地
   * @param detail true 返回省市运营商，false 只返回省
   * @returns {String}
   */
  getIpRegion ({ ip, detail = false }) {
    if (!ip) return ''
    try {
      // 将 IPv6 格式的 IPv4 地址转换为 IPv4 格式
      ip = ip.replace(/^::ffff:/, '')
      // Zeabur 返回的地址带端口号，去掉端口号。TODO: 不知道该怎么去掉 IPv6 地址后面的端口号
      ip = ip.replace(/:[0-9]*$/, '')
      const { region } = getIpRegionSearcher().binarySearchSync(ip)
      const [country,, province, city, isp] = region.split('|')
      // 有省显示省，没有省显示国家
      const area = province.trim() && province !== '0' ? province : country
      if (detail) {
        return area === city ? [city, isp].join(' ') : [area, city, isp].join(' ')
      } else {
        return area.replace(/(省|市)$/, '')
      }
    } catch (e) {
      logger.warn('IP 属地查询失败：', e.message, ip)
      return ''
    }
  },
  parseCommentForAdmin (comments) {
    for (const comment of comments) {
      comment.ipRegion = fn.getIpRegion({ ip: comment.ip, detail: true })
    }
    return comments
  },
  getRelativeUrl (url) {
    try {
      return (new URL(url)).pathname
    } catch (e) {
      // 如果 url 已经是一个相对地址了，会报 ERR_INVALID_URL，返回原始 url 就行
      return url
    }
  },
  normalizeMail (mail) {
    return String(mail).trim().toLowerCase()
  },
  equalsMail (mail1, mail2) {
    if (!mail1 || !mail2) return false
    return fn.normalizeMail(mail1) === fn.normalizeMail(mail2)
  },
  getMailMd5 (comment) {
    if (comment.mailMd5) {
      return comment.mailMd5
    }
    if (comment.mail) {
      return md5(fn.normalizeMail(comment.mail))
    }
    return md5(comment.nick)
  },
  getMailSha256 (comment) {
    if (comment.mail) {
      return sha256(fn.normalizeMail(comment.mail))
    }
    return sha256(comment.nick)
  },
  getAvatar (comment, config) {
    if (comment.avatar) {
      return comment.avatar
    } else {
      const gravatarCdn = config.GRAVATAR_CDN || 'weavatar.com'
      let defaultGravatar = `initials&name=${comment.nick}`
      if (config.DEFAULT_GRAVATAR) {
        defaultGravatar = config.DEFAULT_GRAVATAR
      }
      const mailHash = gravatarCdn === 'cravatar.cn' ? fn.getMailMd5(comment) : fn.getMailSha256(comment) // Cravatar 不支持 sha256
      return `https://${gravatarCdn}/avatar/${mailHash}?d=${defaultGravatar}`
    }
  },
  isUrl (s) {
    return /^http(s)?:\/\//.test(s)
  },
  isQQ (mail) {
    return /^[1-9][0-9]{4,10}$/.test(mail) ||
      /^[1-9][0-9]{4,10}@qq.com$/i.test(mail)
  },
  addQQMailSuffix (mail) {
    if (/^[1-9][0-9]{4,10}$/.test(mail)) return `${mail}@qq.com`
    else return mail
  },
  async getQQAvatar (qq) {
    try {
      const qqNum = qq.replace(/@qq.com/ig, '')
      // TODO: 这个接口已经失效了，暂时找不到新的接口
      const result = await axios.get(`https://aq.qq.com/cn2/get_img/get_face?img_type=3&uin=${qqNum}`)
      return result.data?.url || null
    } catch (e) {
      logger.warn('获取 QQ 头像失败：', e)
    }
  },
  // 判断是否存在管理员密码
  async getPasswordStatus (config, version) {
    return {
      code: RES_CODE.SUCCESS,
      status: !!config.ADMIN_PASS,
      credentials: !!config.CREDENTIALS,
      version
    }
  },
  // 预垃圾评论检测
  preCheckSpam ({ comment, nick }, config) {
    // 长度限制
    let limitLength = parseInt(config.LIMIT_LENGTH)
    if (Number.isNaN(limitLength)) limitLength = 500
    if (limitLength && comment.length > limitLength) {
      throw new Error('评论内容过长')
    }
    if (config.BLOCKED_WORDS) {
      const commentLowerCase = comment.toLowerCase()
      const nickLowerCase = nick.toLowerCase()
      for (const blockedWord of config.BLOCKED_WORDS.split(',')) {
        const blockedWordLowerCase = blockedWord.trim().toLowerCase()
        if (commentLowerCase.indexOf(blockedWordLowerCase) !== -1 || nickLowerCase.indexOf(blockedWordLowerCase) !== -1) {
          throw new Error('包含屏蔽词')
        }
      }
    }
    if (config.AKISMET_KEY === 'MANUAL_REVIEW') {
      // 人工审核
      logger.info('已使用人工审核模式，评论审核后才会发表~')
      return true
    } else if (config.FORBIDDEN_WORDS) {
      // 违禁词检测
      const commentLowerCase = comment.toLowerCase()
      const nickLowerCase = nick.toLowerCase()
      for (const forbiddenWord of config.FORBIDDEN_WORDS.replace(/,+$/, '').split(',')) {
        const forbiddenWordLowerCase = forbiddenWord.trim().toLowerCase()
        if (commentLowerCase.indexOf(forbiddenWordLowerCase) !== -1 || nickLowerCase.indexOf(forbiddenWordLowerCase) !== -1) {
          logger.warn('包含违禁词，直接标记为垃圾评论~')
          return true
        }
      }
    }
    return false
  },
  async checkTurnstileCaptcha ({ ip, turnstileToken, turnstileTokenSecretKey }) {
    try {
      const formData = new FormData()
      formData.append('secret', turnstileTokenSecretKey)
      formData.append('response', turnstileToken)
      formData.append('remoteip', ip)
      const { data } = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData, {
        headers: formData.getHeaders()
      })
      logger.log('验证码检测结果', data)
      if (!data.success) throw new Error('验证码错误')
    } catch (e) {
      throw new Error('验证码检测失败: ' + e.message)
    }
  },
  async getConfig ({ config, VERSION, isAdmin }) {
    return {
      code: RES_CODE.SUCCESS,
      config: {
        VERSION,
        IS_ADMIN: isAdmin,
        SITE_NAME: config.SITE_NAME,
        SITE_URL: config.SITE_URL,
        MASTER_TAG: config.MASTER_TAG,
        COMMENT_BG_IMG: config.COMMENT_BG_IMG,
        GRAVATAR_CDN: config.GRAVATAR_CDN,
        DEFAULT_GRAVATAR: config.DEFAULT_GRAVATAR,
        SHOW_IMAGE: config.SHOW_IMAGE || 'true',
        IMAGE_CDN: config.IMAGE_CDN,
        LIGHTBOX: config.LIGHTBOX || 'false',
        SHOW_EMOTION: config.SHOW_EMOTION || 'true',
        EMOTION_CDN: config.EMOTION_CDN,
        COMMENT_PLACEHOLDER: config.COMMENT_PLACEHOLDER,
        DISPLAYED_FIELDS: config.DISPLAYED_FIELDS,
        REQUIRED_FIELDS: config.REQUIRED_FIELDS,
        HIDE_ADMIN_CRYPT: config.HIDE_ADMIN_CRYPT,
        HIGHLIGHT: config.HIGHLIGHT || 'true',
        HIGHLIGHT_THEME: config.HIGHLIGHT_THEME,
        HIGHLIGHT_PLUGIN: config.HIGHLIGHT_PLUGIN,
        LIMIT_LENGTH: config.LIMIT_LENGTH,
        TURNSTILE_SITE_KEY: config.TURNSTILE_SITE_KEY
      }
    }
  },
  async getConfigForAdmin ({ config, isAdmin }) {
    if (isAdmin) {
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
  },
  // 请求参数校验
  validate (event = {}, requiredParams = []) {
    for (const requiredParam of requiredParams) {
      if (!event[requiredParam]) {
        throw new Error(`参数"${requiredParam}"不合法`)
      }
    }
  }
}

module.exports = fn

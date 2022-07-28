const { axios, bowser, ipToRegion, md5 } = require('./utils/lib')
const { RES_CODE } = require('./constants')
const ipRegionSearcher = ipToRegion.create() // 初始化 IP 属地

module.exports = {
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
      if (url) query.push(...this.getUrlQuery(url))
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
          .map((item) => this.toCommentDto(item, uid, [], comments, config))
          .sort((a, b) => a.created - b.created)
        result.push(this.toCommentDto(comment, uid, replies, [], config))
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
        const os = ua.getOS()
        displayOs = [os.name, os.versionName ? os.versionName : os.version].join(' ')
        displayBrowser = [ua.getBrowserName(), ua.getBrowserVersion()].join(' ')
      } catch (e) {
        console.log('bowser 错误：', e)
      }
    }
    const showRegion = !!config.SHOW_REGION && config.SHOW_REGION !== 'false'
    return {
      id: comment._id.toString(),
      nick: comment.nick,
      avatar: comment.avatar,
      mailMd5: comment.mailMd5 || md5(comment.mail),
      link: comment.link,
      comment: comment.comment,
      os: displayOs,
      browser: displayBrowser,
      ipRegion: showRegion ? this.getIpRegion({ ip: comment.ip }) : '',
      master: comment.master,
      like: comment.like ? comment.like.length : 0,
      liked: comment.like ? comment.like.findIndex((item) => item === uid) > -1 : false,
      replies: replies,
      rid: comment.rid,
      pid: comment.pid,
      ruser: this.ruser(comment.pid, comments),
      top: comment.top,
      isSpam: comment.isSpam,
      created: comment.created,
      updated: comment.updated
    }
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
      const { region } = ipRegionSearcher.binarySearchSync(ip)
      const [country,, province, city, isp] = region.split('|')
      // 有省显示省，没有省显示国家
      const area = province.trim() ? province : country
      if (detail) {
        return area === city ? [city, isp].join(' ') : [area, city, isp].join(' ')
      } else {
        return area
      }
    } catch (e) {
      console.error('IP 属地查询失败：', e)
      return ''
    }
  },
  parseCommentForAdmin (comments) {
    for (const comment of comments) {
      comment.ipRegion = this.getIpRegion({ ip: comment.ip, detail: true })
    }
    return comments
  },
  getRelativeUrl (url) {
    let x = url.indexOf('/')
    for (let i = 0; i < 2; i++) {
      x = url.indexOf('/', x + 1)
    }
    return url.substring(x)
  },
  getAvatar (comment, config) {
    if (comment.avatar) {
      return comment.avatar
    } else {
      const gravatarCdn = config.GRAVATAR_CDN || 'cravatar.cn'
      const defaultGravatar = config.DEFAULT_GRAVATAR || 'identicon'
      const mailMd5 = comment.mailMd5 || md5(comment.mail)
      return `https://${gravatarCdn}/avatar/${mailMd5}?d=${defaultGravatar}`
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
  },
  // 判断是否存在管理员密码
  async getPasswordStatus (version, config) {
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
    if (config.AKISMET_KEY === 'MANUAL_REVIEW') {
      // 人工审核
      console.log('已使用人工审核模式，评论审核后才会发表~')
      return true
    } else if (config.FORBIDDEN_WORDS) {
      // 违禁词检测
      for (const forbiddenWord of config.FORBIDDEN_WORDS.split(',')) {
        if (comment.indexOf(forbiddenWord.trim()) !== -1 || nick.indexOf(forbiddenWord.trim()) !== -1) {
          console.log('包含违禁词，直接标记为垃圾评论~')
          return true
        }
      }
    }
    return false
  },
  async getConfig ({ config, VERSION, isAdmin }) {
    return {
      code: RES_CODE.SUCCESS,
      config: {
        VERSION,
        IS_ADMIN: await isAdmin(),
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
        HIGHLIGHT_THEME: config.HIGHLIGHT_THEME,
        LIMIT_LENGTH: config.LIMIT_LENGTH
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

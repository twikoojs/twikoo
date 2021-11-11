import t, { setLanguage } from './i18n'
import timeago from './timeago'
import marked from './marked'
import renderCode from './highlight'
import { isUrl, call } from './api'
import { isQQ, getQQAvatar } from './avatar'
import { initOwoEmotion, initMarkedOwo } from './emotion'

const isNotSet = (option) => {
  return option === undefined || option === null || option === ''
}

const logger = {
  log: (message, e) => {
    console.log(`Twikoo: ${message}`, e)
  },
  info: (message, e) => {
    console.info(`Twikoo: ${message}`, e)
  },
  warn: (message, e) => {
    console.warn(`Twikoo: ${message}`, e)
  },
  error: (message, e) => {
    console.error(`Twikoo: ${message}`, e)
  }
}

const timestamp = (date = new Date()) => {
  return date.getTime()
}

const convertLink = (link) => {
  if (!link) return ''
  if (link.substring(0, 4) !== 'http') return `http://${link}`
  return link
}

// 云函数版本
let twikooFuncVer
const getFuncVer = async (tcb) => {
  if (!twikooFuncVer) {
    twikooFuncVer = await call(tcb, 'GET_FUNC_VERSION')
  }
  return twikooFuncVer
}

const getCommentsCountApi = async (tcb, options) => {
  if (!(options.urls instanceof Array)) {
    throw new Error('urls 参数有误')
  }
  if (options.urls.length === 0) {
    return []
  }
  const result = await call(tcb, 'GET_COMMENTS_COUNT', options)
  return result.result.data
}

const getRecentCommentsApi = async (tcb, options) => {
  const result = await call(tcb, 'GET_RECENT_COMMENTS', options)
  // 封装相对评论时间
  for (const comment of result.result.data) {
    comment.relativeTime = timeago(comment.created)
  }
  return result.result.data
}

/**
 * 由于 Twikoo 早期版本将 path 视为表达式处理，
 * 而其他同类评论系统都是把 path 视为字符串常量，
 * 为同时兼顾早期版本和统一性，就有了这个方法。
 */
const getUrl = (path) => {
  let url
  if (window.TWIKOO_MAGIC_PATH) {
    // 从全局变量获取 path
    url = window.TWIKOO_MAGIC_PATH
  } else if (path && typeof path === 'string') {
    try {
      // 参数视为表达式获取 path
      // eslint-disable-next-line no-eval
      url = eval(path)
      if (typeof url !== 'string') {
        // 参数视为字符串常量获取 path
        url = path
      }
    } catch (e) {
      // 参数视为字符串常量获取 path
      url = path
    }
  } else {
    // 默认 path
    url = window.location.pathname
  }
  return url
}

/**
 * 读取文本文件内容
 */
const readAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onloadend = () => {
      if (reader.error) {
        reject(reader.error)
      } else {
        resolve(reader.result)
      }
    }
  })
}

const renderLinks = (el) => {
  let aEls = []
  if (el instanceof Array) {
    el.forEach((item) => {
      aEls.push(...item.getElementsByTagName('a'))
    })
  } else if (el instanceof Element) {
    aEls = el.getElementsByTagName('a')
  }
  for (const aEl of aEls) {
    aEl.setAttribute('target', '_blank')
    aEl.setAttribute('rel', 'noopener noreferrer')
  }
}

const renderMath = (el, options) => {
  const defaultOptions = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  }
  if (typeof renderMathInElement === 'function') {
    /* eslint-disable-next-line no-undef */
    renderMathInElement(el, options || defaultOptions)
  }
}

export {
  t,
  setLanguage,
  isNotSet,
  logger,
  timeago,
  timestamp,
  convertLink,
  marked,
  renderCode,
  isUrl,
  call,
  getFuncVer,
  isQQ,
  getQQAvatar,
  initOwoEmotion,
  initMarkedOwo,
  getCommentsCountApi,
  getRecentCommentsApi,
  getUrl,
  readAsText,
  renderLinks,
  renderMath
}

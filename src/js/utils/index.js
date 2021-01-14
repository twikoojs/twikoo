import t from './i18n'
import timeago from './timeago'
import marked from './marked'
import renderCode from './highlight'
import call from './api'
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
  isNotSet,
  logger,
  timeago,
  timestamp,
  convertLink,
  marked,
  renderCode,
  call,
  getFuncVer,
  isQQ,
  getQQAvatar,
  initOwoEmotion,
  initMarkedOwo,
  getCommentsCountApi,
  getRecentCommentsApi,
  renderLinks,
  renderMath
}

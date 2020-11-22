import timeago from './timeago'
import marked from './marked'
import call from './api'

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

export {
  isNotSet,
  logger,
  timeago,
  timestamp,
  convertLink,
  marked,
  call,
  getFuncVer
}

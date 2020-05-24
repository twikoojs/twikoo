import constant from './constant'
import timeago from './timeago'

const isNotSet = (option) => {
  return option === undefined || option === null || option === ''
}

const logger = {
  info: (message) => {
    console.log(`${constant.logPrefix} ${message}`)
  },
  warn: (message) => {
    console.warn(`${constant.logPrefix} ${message}`)
  },
  error: (message) => {
    console.error(`${constant.logPrefix} ${message}`)
  }
}

export {
  constant,
  isNotSet,
  logger,
  timeago
}

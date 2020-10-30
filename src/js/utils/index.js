import timeago from './timeago'
import marked from './marked'

const isNotSet = (option) => {
  return option === undefined || option === null || option === ''
}

const logger = {
  info: (message) => {
    console.log(`Twikoo: ${message}`)
  },
  warn: (message) => {
    console.warn(`Twikoo: ${message}`)
  },
  error: (message) => {
    console.error(`Twikoo: ${message}`)
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

export {
  isNotSet,
  logger,
  timeago,
  timestamp,
  convertLink,
  marked
}

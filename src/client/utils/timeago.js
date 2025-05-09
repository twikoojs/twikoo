import { logger, t } from '.'

const timeAgo = (date) => {
  if (typeof date === 'number') {
    date = new Date(date)
  }
  if (date) {
    try {
      const oldTime = date.getTime()
      const currTime = Date.now()
      const diffValue = currTime - oldTime

      const days = Math.floor(diffValue / (24 * 3600 * 1000))
      if (days === 0) {
        // 计算相差小时数
        const leave1 = diffValue % (24 * 3600 * 1000) // 计算天数后剩余的毫秒数
        const hours = Math.floor(leave1 / (3600 * 1000))
        if (hours === 0) {
          // 计算相差分钟数
          const leave2 = leave1 % (3600 * 1000) // 计算小时数后剩余的毫秒数
          const minutes = Math.floor(leave2 / (60 * 1000))
          if (minutes === 0) {
            // 计算相差秒数
            const leave3 = leave2 % (60 * 1000) // 计算分钟数后剩余的毫秒数
            const seconds = Math.round(leave3 / 1000)
            return seconds + ` ${t('TIMEAGO_SECONDS')}`
          }
          return minutes + ` ${t('TIMEAGO_MINUTES')}`
        }
        return hours + ` ${t('TIMEAGO_HOURS')}`
      }
      if (days < 0) return t('TIMEAGO_NOW')

      if (days < 8) {
        return days + ` ${t('TIMEAGO_DAYS')}`
      } else {
        return dateFormat(date)
      }
    } catch (error) {
      logger.log('timeAgo 错误', error)
    }
  }
}

const dateFormat = (date) => {
  const vDay = padWithZeros(date.getDate(), 2)
  const vMonth = padWithZeros(date.getMonth() + 1, 2)
  const vYear = padWithZeros(date.getFullYear(), 2)
  return `${vYear}-${vMonth}-${vDay}`
}

const padWithZeros = (vNumber, width) => {
  let numAsString = vNumber.toString()
  while (numAsString.length < width) {
    numAsString = '0' + numAsString
  }
  return numAsString
}

export default timeAgo

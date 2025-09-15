import { version } from './version'
import { install } from './utils/tcb'
import { render } from './view'
import { setLanguage, logger, isUrl, getCommentsCountApi, getRecentCommentsApi } from './utils'

// 添加全局Promise拒绝处理
window.addEventListener('unhandledrejection', (event) => {
  logger.error('未处理的Promise拒绝:', event.reason)
  // 阻止默认行为，避免在控制台显示"Uncaught (in promise)"错误
  event.preventDefault()
})

async function initTcb (options) {
  if (typeof cloudbase === 'undefined') {
    logger.error('Please import cloudbase firstly:\n<script src="https://imgcache.qq.com/qcloud/cloudbase-js-sdk/1.3.3/cloudbase.full.js"></script>')
    return null
  }
  /* eslint-disable-next-line no-undef */
  return await install(cloudbase, options)
}

async function init (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  setLanguage(options)
  render(tcb, options)
}

async function getCommentsCount (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  return await getCommentsCountApi(tcb, options)
}

async function getRecentComments (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  return await getRecentCommentsApi(tcb, options)
}

export default init
export {
  version,
  init,
  getCommentsCount,
  getRecentComments
}

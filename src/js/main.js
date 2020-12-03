import { version } from '../../package.json'
import { install } from './tcb'
import { render } from '../view'
import { logger, getCommentsCountApi, getRecentCommentsApi } from './utils'

async function initTcb (options) {
  if (typeof cloudbase === 'undefined') {
    logger.error('Please import cloudbase firstly:\n<script src="https://imgcache.qq.com/qcloud/cloudbase-js-sdk/1.3.3/cloudbase.full.js"></script>')
    return null
  }
  /* eslint-disable-next-line no-undef */
  return await install(cloudbase, options)
}

async function init (options = {}) {
  const data = await initTcb(options)
  render(data, options)
}

async function getCommentsCount (options = {}) {
  const data = await initTcb(options)
  return await getCommentsCountApi(data, options)
}

async function getRecentComments (options = {}) {
  const data = await initTcb(options)
  return await getRecentCommentsApi(data, options)
}

export default init
export {
  version,
  init,
  getCommentsCount,
  getRecentComments
}

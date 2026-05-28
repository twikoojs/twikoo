import { version } from './version'
import { install } from './utils/tcb'
import { render } from './view'
import { setLanguage, isUrl, getCommentsCountApi, getRecentCommentsApi, getVisitorsCountApi, updateVisitorsCount } from './utils'
import cloudbase from '@cloudbase/js-sdk/app'
import '@cloudbase/js-sdk/auth'
import '@cloudbase/js-sdk/functions'
import '@cloudbase/js-sdk/storage'

async function initTcb (options) {
  return await install(cloudbase, options)
}

async function init (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  setLanguage(options)
  render(tcb, options)
  await updateVisitorsCount(tcb, options)
}

async function getCommentsCount (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  return await getCommentsCountApi(tcb, options)
}

async function getRecentComments (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  return await getRecentCommentsApi(tcb, options)
}

async function getVisitorsCount (options = {}) {
  const tcb = isUrl(options.envId) ? null : await initTcb(options)
  return await getVisitorsCountApi(tcb, options)
}

export default init
export {
  version,
  init,
  getCommentsCount,
  getRecentComments,
  getVisitorsCount
}

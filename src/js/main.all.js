import { version } from '../../package.json'
import { install } from './tcb'
import { render } from '../view'
import { getCommentsCountApi, getRecentCommentsApi } from './utils'
import cloudbase from '@cloudbase/js-sdk/app'
import '@cloudbase/js-sdk/auth'
import '@cloudbase/js-sdk/functions'

async function initTcb (options) {
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

import { install } from './tcb'
import { render } from '../view'
import { logger } from './utils'

async function init (options = {}) {
  if (typeof cloudbase === 'undefined') {
    logger.error('Please import cloudbase firstly:\n<script src="https://imgcache.qq.com/qcloud/cloudbase-js-sdk/1.0.3/cloudbase.full.js"></script>')
    return null
  }
  /* eslint-disable-next-line no-undef */
  const data = await install(cloudbase, options)
  render(data, options)
}

export default init
export {
  init
}

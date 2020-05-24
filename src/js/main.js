import { install } from './tcb'
import { render } from '../view'
import { logger } from './utils'

async function init (options = {}, tcbSdk) {
  if (typeof tcb === 'undefined') {
    logger.error('Please import tcbjs firstly: <script src="https://imgcache.qq.com/qcloud/tcbjs/1.6.2/tcb.js"></script>')
    return null
  }
  /* eslint-disable-next-line no-undef */
  const data = await install(options, tcb)
  render(data)
}

export {
  init
}

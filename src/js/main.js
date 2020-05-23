import { install } from './tcb'
import { logger } from './utils'

/**
 * Constructor
 */
class Maeco {
  constructor (options = {}) {
    if (typeof tcb === 'undefined') {
      logger.error('Please import tcbjs firstly: <script src="https://imgcache.qq.com/qcloud/tcbjs/1.6.2/tcb.js"></script>')
      return null
    }
    /* eslint-disable-next-line no-undef */
    return install(options, tcb)
  }
}

export default Maeco

import { install } from './tcb'
import tcbSdk from 'tcb-js-sdk'

/**
 * Constructor
 */
class Maeco {
  constructor (options = {}) {
    return install(options, tcbSdk)
  }
}

export default Maeco

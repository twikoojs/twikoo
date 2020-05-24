import { install } from './tcb'
import { render } from '../view'
import * as tcbSdk from 'tcb-js-sdk'
import 'bulma/css/bulma.css'

/**
 * Constructor
 */
async function init (options = {}) {
  const data = await install(options, tcbSdk)
  render(data)
}

export {
  init
}

import { install } from './tcb'
import { render } from '../view'
import * as tcbSdk from 'tcb-js-sdk'

async function init (options = {}) {
  const data = await install(options, tcbSdk)
  render(data, options)
}

export {
  init
}

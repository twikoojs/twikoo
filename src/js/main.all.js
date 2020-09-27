import { install } from './tcb'
import { render } from '../view'
import cloudbase from '@cloudbase/js-sdk/app'
import '@cloudbase/js-sdk/auth'
import '@cloudbase/js-sdk/functions'

async function init (options = {}) {
  const data = await install(cloudbase, options)
  render(data, options)
}

export default init
export {
  init
}

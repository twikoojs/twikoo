import {
  isNotSet,
  logger
} from '.'

const builtInOptions = [
  { key: 'envId', required: true }
]

const tcb = {
  sdk: null,
  app: null,
  auth: null
}

async function install (tcbSdk, options = {}) {
  tcb.sdk = tcbSdk
  checkOptions(options)
  await init(options)
  return tcb
}

function checkOptions (options) {
  const missingOptions = []
  for (const option of builtInOptions) {
    if (option.default && isNotSet(options[option.key])) {
      options[option.key] = option.default
    } else if (option.required && isNotSet(options[option.key])) {
      missingOptions.push(option.key)
    }
  }
  if (missingOptions.length > 0) {
    for (const missingOption of missingOptions) {
      logger.warn(`${missingOption} is required`)
    }
    throw new Error('Twikoo: failed to init')
  }
}

async function init (options) {
  initApp(options)
  await initAuth()
}

function initApp (options) {
  tcb.app = tcb.sdk.init({
    env: options.envId,
    region: options.region
  })
}

async function initAuth () {
  return new Promise((resolve, reject) => {
    tcb.auth = tcb.app.auth({ persistence: 'local' })
    if (tcb.auth.hasLoginState()) {
      resolve()
    } else {
      tcb.auth
        .anonymousAuthProvider()
        .signIn()
        .then(resolve)
        .catch(reject)
    }
  })
}

export {
  tcb,
  install
}

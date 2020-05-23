import {
  isNotSet,
  logger
} from '../utils'

const builtInOptions = [
  { key: 'envId', required: true },
  { key: 'collection', default: 'comment' }
]

const tcb = {
  sdk: null,
  app: null,
  auth: null,
  db: null
}

function install (options = {}, tcbSdk) {
  tcb.sdk = tcbSdk
  checkOptions(options)
  init(options)
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
  }
}

async function init (options) {
  initApp(options.envId)
  await initAuth()
  initDb(options.collection)
}

function initApp (envId) {
  tcb.app = tcb.sdk.init({ env: envId })
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

function initDb (collectionName) {
  tcb.db = tcb.app.database()
}

export {
  tcb,
  install
}

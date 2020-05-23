import * as tcbSdk from 'tcb-js-sdk'
import { isNotSet } from './utils'
import { Comment } from './entites'

const tcb = {
  app: null,
  auth: null,
  db: null
}

const builtInOptions = [
  { key: 'envId', required: true },
  { key: 'collection', default: 'comment' }
]

/**
 * Constructor
 */
class Maeco {
  constructor (options = {}) {
    checkOptions(options)
    init(options)
  }
}

function checkOptions (options) {
  const missingOptions = []
  if (!options) {
    missingOptions.push('options')
  } else {
    for (const option of builtInOptions) {
      if (option.default && isNotSet(options[option.key])) {
        options[option.key] = option.default
      } else if (option.required && isNotSet(options[option.key])) {
        missingOptions.push(option.key)
      }
    }
  }
  return missingOptions
}

async function init (options) {
  initApp(options.envId)
  await initAuth()
  initDb(options.collection)
}

function initApp (envId) {
  tcb.app = tcbSdk.init({ env: envId })
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
  const commentCollection = tcb.db.collection(collectionName)

  // For test.
  commentCollection.add(new Comment({
    url: 'url',
    nick: 'nick',
    mail: 'mail',
    site: 'site',
    comment: 'comment',
    ua: 'ua',
    ip: 'ip'
  }))
}

export default Maeco

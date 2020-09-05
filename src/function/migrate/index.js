const tcb = require('@cloudbase/node-sdk')

const collections = [
  'comment',
  'config',
  'counter'
]

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()

/**
 * 建立数据库 collections
 */
exports.main = async (event, context) => {
  const res = {}
  for (const collection of collections) {
    res[collection] = await db.createCollection(collection)
  }

  return res
}

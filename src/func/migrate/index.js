const tcb = require('tcb-admin-node')

const collections = [
  'toot',
  'comment',
  'like'
]

exports.main = async (event, context) => {
  const app = tcb.init({
    env: tcb.getCurrentEnv()
  })
  const db = app.database()
  const res = {}
  for (const collection of collections) {
    res[collection] = await db.createCollection()
  }

  return res
}

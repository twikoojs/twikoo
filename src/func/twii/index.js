const tcb = require('tcb-admin-node')

exports.main = async (event, context) => {
  const app = tcb.init({
    env: tcb.getCurrentEnv()
  })
  const db = app.database()
  const res = {}

  return res
}

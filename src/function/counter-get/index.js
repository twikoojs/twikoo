const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()

/**
 * 获取文章点击量
 * @param {String} event.url 文章地址
 */
exports.main = async (event, context) => {
  const res = {}
  try {
    validate(event)
    const record = await db
      .collection('counter')
      .where({ url: event.url })
      .get()
    res.data = record.data[0] ? record.data[0] : {}
    res.time = res.data ? res.data.time : 0
  } catch (e) {
    res.message = e.message
    return res
  }
  return res
}

/**
 * 请求参数校验
 */
function validate (event) {
  const requiredParams = ['url']
  for (const requiredParam of requiredParams) {
    if (!event[requiredParam]) {
      throw new Error(`参数"${requiredParam}"不合法`)
    }
  }
}

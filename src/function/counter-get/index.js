const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

/**
 * 获取文章点击量
 * @param {String} event.url 文章地址
 */
exports.main = async (event, context) => {
  const res = {}
  try {
    validate(event)
    let record
    try {
      record = await read(event.url)
    } catch (e) {
      await createCollections()
      record = await read(event.url)
    }
    res.data = record.data[0] ? record.data[0] : {}
    res.time = res.data ? res.data.time : 0
    res.updated = await inc(event)
  } catch (e) {
    res.message = e.message
    return res
  }
  return res
}

async function read (url) {
  return await db
    .collection('counter')
    .where({ url })
    .get()
}

/**
 * 更新阅读数
 * @param {String} event.url 文章地址
 * @param {String} event.title 文章标题
 */
async function inc (event) {
  let result
  result = await db
    .collection('counter')
    .where({ url: event.url })
    .update({
      title: event.title,
      time: _.inc(1),
      updated: new Date().getTime()
    })
  if (result.updated === 0) {
    result = await db
      .collection('counter')
      .add({
        url: event.url,
        title: event.title,
        time: 1,
        created: new Date().getTime(),
        updated: new Date().getTime()
      })
  }
  return result.updated || result.inserted
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

/**
 * 建立数据库 collections
 */
async function createCollections () {
  return await db.createCollection('counter')
}

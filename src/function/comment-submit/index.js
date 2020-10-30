const tcb = require('@cloudbase/node-sdk')
const md5 = require('blueimp-md5')
const { noticeMaster, noticeReply, noticeWeChat } = require('./utils/mailer')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()

let config

/**
 * 提交评论
 * @param {String} event.nick 昵称
 * @param {String} event.mail 邮箱
 * @param {String} event.link 网址
 * @param {String} event.ua UserAgent
 * @param {String} event.url 评论页地址
 * @param {String} event.comment 评论内容
 * @param {String} event.pid 回复的 ID
 * @param {String} event.rid 评论楼 ID
 */
exports.main = async (event, context) => {
  const res = {}
  try {
    validate(event)
  } catch (e) {
    res.message = e.message
    return res
  }
  try {
    await readConfig()
  } catch (e) {
    await createCollections()
    await readConfig()
  }
  let comment
  try {
    comment = await save(event)
  } catch (e) {
    await createCollections()
    comment = await save(event)
  }
  res.id = comment.id
  await sendMail(comment)
  return res
}

async function readConfig () {
  if (!config) {
    config = await db
      .collection('config')
      .limit(1)
      .get()
    config = config.data[0]
  }
}

async function save (event) {
  const data = parse(event)
  const result = await db
    .collection('comment')
    .add(data)
  data.id = result.id
  return data
}

async function sendMail (comment) {
  await Promise.all([
    noticeMaster(comment, config),
    noticeReply(comment, config),
    noticeWeChat(comment, config)
  ]).catch(console.error)
}

/**
 * 转为数据库存储格式
 */
function parse (comment) {
  const timestamp = new Date().getTime()
  return {
    nick: comment.nick ? comment.nick : 'Anonymous',
    mail: comment.mail ? comment.mail : '',
    mailMd5: comment.mail ? md5(comment.mail) : '',
    link: comment.link ? comment.link : '',
    ua: comment.ua,
    ip: auth.getClientIP(),
    master: config ? comment.mail === config.BLOGGER_EMAIL : false,
    url: comment.url,
    href: comment.href,
    comment: comment.comment,

    pid: comment.pid ? comment.pid : comment.rid,
    rid: comment.rid,
    created: timestamp,
    updated: timestamp
  }
}

/**
 * 请求参数校验
 */
function validate (event) {
  const requiredParams = ['url', 'ua', 'comment']
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
  const collections = ['comment', 'config']
  const res = {}
  for (const collection of collections) {
    res[collection] = await db.createCollection(collection)
  }

  return res
}

const tcb = require('@cloudbase/node-sdk')
const md5 = require('blueimp-md5')
const bowser = require('bowser')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()
const _ = db.command

/**
 * 获取评论
 * @param {String} event.url 评论页地址
 */
exports.main = async (event, context) => {
  const res = {}
  let uid
  try {
    validate(event)
    uid = await auth.getEndUserInfo().userInfo.uid
    const data = await db
      .collection('comment')
      .where({
        url: event.url,
        isSpam: _.neq(true)
      })
      .orderBy('created', 'desc')
      .get()
    res.data = parse(data.data, uid)
  } catch (e) {
    res.data = []
    res.message = e.message
  }
  return res
}

/**
 * 筛除隐私字段，拼接回复列表
 */
function parse (comments, uid) {
  const result = []
  for (const comment of comments) {
    if (!comment.rid) {
      const replies = comments
        .filter((item) => item.rid === comment._id)
        .map((item) => toDto(item, uid, [], comments))
        .sort((a, b) => a.created - b.created)
      result.push(toDto(comment, uid, replies))
    }
  }
  return result
}

function toDto (comment, uid, replies = [], comments = []) {
  const ua = bowser.getParser(comment.ua)
  const os = ua.getOS()
  return {
    id: comment._id,
    nick: comment.nick,
    mailMd5: comment.mailMd5 || md5(comment.mail),
    link: comment.link,
    comment: comment.comment,
    os: [os.name, os.versionName ? os.versionName : os.version].join(' '),
    browser: [ua.getBrowserName(), ua.getBrowserVersion()].join(' '),
    master: comment.master,
    like: comment.like ? comment.like.length : 0,
    liked: comment.like ? comment.like.findIndex((item) => item === uid) > -1 : false,
    replies: replies,
    rid: comment.rid,
    pid: comment.pid,
    ruser: ruser(comment.pid, comments),
    created: comment.created,
    updated: comment.updated
  }
}

/**
 * Get replied user nick name.
 */
function ruser (pid, comments = []) {
  const comment = comments.find((item) => item._id === pid)
  return comment ? comment.nick : null
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

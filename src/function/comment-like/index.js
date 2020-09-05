const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()

/**
 * 点赞云函数
 * @param {String} event.id 评论 ID
 */
exports.main = async (event, context) => {
  const res = {}
  let uid
  try {
    validate(event)
    uid = await auth.getEndUserInfo().userInfo.uid
  } catch (e) {
    res.message = e.message
    return res
  }
  res.updated = await like(event.id, uid)
  return res
}

/**
 * 点赞 / 取消点赞
 * @param {String} id 评论 ID
 * @param {String} uid 用户 ID
 */
async function like (id, uid) {
  const record = db
    .collection('comment')
    .where({ _id: id })
  const comment = await record.get()
  let likes = comment.data[0] && comment.data[0].like ? comment.data[0].like : []
  if (likes.findIndex((item) => item === uid) === -1) {
    // 赞
    likes.push(uid)
  } else {
    // 取消赞
    likes = likes.filter((item) => item !== uid)
  }
  const result = await record.update({ like: likes })
  return result.updated
}

/**
 * 请求参数校验
 */
function validate (event) {
  const requiredParams = ['id']
  for (const requiredParam of requiredParams) {
    if (!event[requiredParam]) {
      throw new Error(`参数"${requiredParam}"不合法`)
    }
  }
}

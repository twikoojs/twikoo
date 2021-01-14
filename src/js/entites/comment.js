import { timestamp } from '../utils'

/**
 * 评论类
 */
class Comment {
  constructor (model = {}) {
    /* 评论人数据 */
    this.nick = model.nick // 昵称
    this.mail = model.mail // 邮箱
    this.mailMd5 = model.mailMd5 // 邮箱 MD5
    this.avatar = model.avatar // 头像 URL
    this.link = model.link // 网址
    this.uid = model.uid // 评论人 User ID

    /* 评论数据 */
    this.url = model.url // 相对评论地址
    this.href = model.href // 完整评论地址
    this.comment = model.comment // 评论内容
    this.ua = model.ua // UserAgent
    this.ip = model.ip // IP 地址
    this.isNotified = model.isNotified // 是否已邮件通知
    this.isSpam = model.isSpam // 是否垃圾评论
    this.master = model.master || false // 博主标识
    this.like = model.like // 赞数
    this.top = model.top // 置顶

    /* 回复数据 */
    this.pid = model.pid // 回复的 ID
    this.rid = model.rid // 评论楼 ID

    /* 时间 */
    this.created = model.created || timestamp()
    this.updated = model.updated || timestamp()
  }
}

export default Comment

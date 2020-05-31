import { timestamp } from '../utils'

class Post {
  constructor (model = {}) {
    this.nick = model.nick
    this.mail = model.mail
    this.site = model.site
    this.ua = model.ua || navigator.userAgent
    this.ip = model.ip
    this.master = model.master || false
    this.content = model.content
    this.created = model.created || timestamp()
    this.updated = model.updated || timestamp()
  }
}

export default Post

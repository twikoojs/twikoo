class Comment {
  constructor (model = {}) {
    this.tid = model.tid
    this.url = model.url
    this.nick = model.nick
    this.mail = model.mail
    this.site = model.site
    this.comment = model.comment
    this.ua = model.ua
    this.ip = model.ip
    this.created = model.created
    this.updated = model.updated
  }
}

export default Comment

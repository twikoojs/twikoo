class Comment {
  constructor (model = {}) {
    this.url = model.url
    this.nick = model.nick
    this.mail = model.mail
    this.site = model.site
    this.comment = model.comment
    this.ua = model.ua
    this.ip = model.ip
  }
}

export default Comment

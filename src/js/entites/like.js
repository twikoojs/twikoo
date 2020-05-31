class Like {
  constructor (model = {}) {
    this.pid = model.pid
    this.nick = model.nick
    this.mail = model.mail
    this.site = model.site
    this.ua = model.ua
    this.ip = model.ip
    this.created = model.created
    this.updated = model.updated
  }
}

export default Like

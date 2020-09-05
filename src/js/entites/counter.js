import { timestamp } from '../utils'

/**
 * 阅读量计数类
 */
class Counter {
  constructor (model = {}) {
    this.url = model.url
    this.title = model.title
    this.time = model.time
    this.created = model.created || timestamp()
    this.updated = model.updated || timestamp()
  }
}

export default Counter

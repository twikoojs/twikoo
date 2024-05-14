const { getRelativeUrl, normalizeMail } = require('.')
const { getMarked, getDomPurify, getMd5 } = require('./lib')
const marked = getMarked()
const md5 = getMd5()

const fn = {
  // 兼容 Leancloud 两种 JSON 导出格式
  jsonParse (content) {
    try {
      return JSON.parse(content)
    } catch (e1) {
      const results = []
      const lines = content.split('\n')
      for (const line of lines) {
        // 逐行 JSON.parse
        try {
          results.push(JSON.parse(line))
        } catch (e2) {}
      }
      return { results }
    }
  },
  // Valine 导入
  async commentImportValine (valineDb, log) {
    let arr
    if (valineDb instanceof Array) {
      arr = valineDb
    } else if (valineDb && valineDb.results) {
      arr = valineDb.results
    }
    if (!arr) {
      log('Valine 评论文件格式有误')
      return
    }
    const comments = []
    log(`共 ${arr.length} 条评论`)
    for (const comment of arr) {
      try {
        const parsed = {
          _id: comment.objectId,
          nick: comment.nick,
          ip: comment.ip,
          mail: comment.mail,
          mailMd5: comment.mailMd5,
          isSpam: comment.isSpam,
          ua: comment.ua || '',
          link: comment.link,
          pid: comment.pid,
          rid: comment.rid,
          master: false,
          comment: comment.comment,
          url: comment.url,
          created: new Date(comment.createdAt).getTime(),
          updated: new Date(comment.updatedAt).getTime()
        }
        comments.push(parsed)
        log(`${comment.objectId} 解析成功`)
      } catch (e) {
        log(`${comment.objectId} 解析失败：${e.message}`)
      }
    }
    log(`解析成功 ${comments.length} 条评论`)
    return comments
  },
  // Disqus 导入
  async commentImportDisqus (disqusDb, log) {
    if (!disqusDb || !disqusDb.disqus || !disqusDb.disqus.thread || !disqusDb.disqus.post) {
      log('Disqus 评论文件格式有误')
      return
    }
    const comments = []
    const getParent = (post) => {
      return post.parent ? disqusDb.disqus.post.find((item) => item.$['dsq:id'] === post.parent[0].$['dsq:id']) : null
    }
    let threads = []
    try {
      threads = disqusDb.disqus.thread.map((thread) => {
        return {
          id: thread.$['dsq:id'],
          title: thread.title[0],
          url: thread.id[0],
          href: thread.link[0]
        }
      })
    } catch (e) {
      log(`无法读取 thread：${e.message}`)
      return
    }
    log(`共 ${disqusDb.disqus.post.length} 条评论`)
    for (const post of disqusDb.disqus.post) {
      try {
        const threadId = post.thread[0].$['dsq:id']
        const thread = threads.find((item) => item.id === threadId)
        const parent = getParent(post)
        let root
        if (parent) {
          let grandParent = parent
          while (true) {
            if (grandParent) root = grandParent
            else break
            grandParent = getParent(grandParent)
          }
        }
        comments.push({
          _id: post.$['dsq:id'],
          nick: post.author[0].name[0],
          mail: '',
          link: '',
          url: thread.url
            ? thread.url.indexOf('http') === 0
              ? getRelativeUrl(thread.url)
              : thread.url
            : getRelativeUrl(thread.href),
          href: thread.href,
          comment: post.message[0],
          ua: '',
          ip: '',
          isSpam: post.isSpam[0] === 'true' || post.isDeleted[0] === 'true',
          master: false,
          pid: parent ? parent.$['dsq:id'] : undefined,
          rid: root ? root.$['dsq:id'] : undefined,
          created: new Date(post.createdAt[0]).getTime(),
          updated: Date.now()
        })
        log(`${post.$['dsq:id']} 解析成功`)
      } catch (e) {
        log(`${post.$['dsq:id']} 解析失败：${e.message}`)
      }
    }
    log(`解析成功 ${comments.length} 条评论`)
    return comments
  },
  // Artalk 导入
  async commentImportArtalk (artalkDb, log) {
    const comments = []
    if (!artalkDb || !artalkDb.length) {
      log('Artalk 评论文件格式有误')
      return
    }
    const DOMPurify = getDomPurify()
    marked.setOptions({
      renderer: new marked.Renderer(),
      gfm: true,
      tables: true,
      breaks: true,
      pedantic: false,
      smartLists: true,
      smartypants: true
    })
    log(`共 ${artalkDb.length} 条评论`)
    for (const comment of artalkDb) {
      try {
        const parsed = {
          _id: `artalk${comment.id}`,
          nick: comment.nick,
          ip: comment.ip,
          mail: comment.email,
          mailMd5: md5(normalizeMail(comment.email)),
          isSpam: false,
          ua: comment.ua || '',
          link: comment.link,
          pid: comment.rid && comment.rid !== '0' ? `artalk${comment.rid}` : undefined,
          rid: comment.rid && comment.rid !== '0' ? `artalk${comment.rid}` : undefined,
          master: false,
          comment: DOMPurify.sanitize(marked.marked(comment.content)),
          url: getRelativeUrl(comment.page_key),
          href: comment.page_key,
          created: new Date(comment.date).getTime(),
          updated: Date.now()
        }
        comments.push(parsed)
        log(`${comment.id} 解析成功`)
      } catch (e) {
        log(`${comment.id} 解析失败：${e.message}`)
      }
    }
    log(`解析成功 ${comments.length} 条评论`)
    return comments
  },
  // Artalk v2 导入
  async commentImportArtalk2 (artalkDb, log) {
    const comments = []
    if (!artalkDb || !artalkDb.length) {
      log('Artalk v2 评论文件格式有误')
      return
    }
    const DOMPurify = getDomPurify()
    marked.setOptions({
      renderer: new marked.Renderer(),
      gfm: true,
      tables: true,
      breaks: true,
      pedantic: false,
      smartLists: true,
      smartypants: true
    })
    log(`共 ${artalkDb.length} 条评论`)
    for (const comment of artalkDb) {
      try {
        const parsed = {
          _id: `artalk${comment.id}`,
          nick: comment.nick,
          ip: comment.ip,
          mail: comment.email,
          mailMd5: md5(normalizeMail(comment.email)),
          isSpam: comment.is_pending === 'true',
          ua: comment.ua || '',
          link: comment.link,
          pid: comment.rid && comment.rid !== '0' ? `artalk${comment.rid}` : undefined,
          rid: comment.rid && comment.rid !== '0' ? `artalk${comment.rid}` : undefined,
          master: false,
          comment: DOMPurify.sanitize(marked.marked(comment.content)),
          url: getRelativeUrl(comment.page_key),
          href: comment.page_key,
          created: new Date(comment.created_at).getTime(),
          updated: Date.now()
        }
        comments.push(parsed)
        log(`${comment.id} 解析成功`)
      } catch (e) {
        log(`${comment.id} 解析失败：${e.message}`)
      }
    }
    log(`解析成功 ${comments.length} 条评论`)
    return comments
  },
  // Twikoo 导入
  async commentImportTwikoo (twikooDb, log) {
    let arr
    if (twikooDb instanceof Array) {
      arr = twikooDb
    } else if (twikooDb && twikooDb.results) {
      arr = twikooDb.results
    }
    if (!arr) {
      log('Twikoo 评论文件格式有误')
      return
    }
    const comments = []
    log(`共 ${arr.length} 条评论`)
    for (const comment of arr) {
      try {
        const parsed = comment
        if (comment._id.$oid) {
          // 解决 id 历史数据问题
          parsed._id = comment._id.$oid
        }
        if (comment.pid === null) {
          delete comment.pid
        }
        if (comment.rid === null) {
          delete comment.rid
        }
        comments.push(parsed)
        log(`${comment._id} 解析成功`)
      } catch (e) {
        log(`${comment._id} 解析失败：${e.message}`)
      }
    }
    log(`解析成功 ${comments.length} 条评论`)
    return comments
  }
}

module.exports = fn

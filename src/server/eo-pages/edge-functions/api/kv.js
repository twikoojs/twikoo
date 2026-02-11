/*!
 * Twikoo EdgeOne Pages Edge Function - KV 数据库操作层
 * (c) 2025-present Mintimate
 * Released under the MIT License.
 * 
 * 使用 EdgeOne Pages KV 存储作为数据库
 * KV 命名空间需要在 EdgeOne Pages 控制台绑定，变量名：TWIKOO_KV
 * 
 * 存储结构：
 * - comments:all    - 所有评论的 JSON 数组（单次读取，减少 KV 调用）
 * - config:main     - 系统配置
 * - counter:{url}   - 页面访问计数
 */

const VERSION = '1.6.44'

// 响应码
const RES_CODE = {
  SUCCESS: 0,
  FAIL: 1000,
  FORBIDDEN: 1403
}

// 评论存储的 KV 键名
const COMMENTS_KEY = 'comments:all'

/**
 * EdgeOne Pages Edge Function 入口
 */
export async function onRequest(context) {
  const { request } = context
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return handleCors(request)
  }
  
  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      code: RES_CODE.SUCCESS,
      message: 'Twikoo KV API 运行正常',
      version: VERSION
    }), {
      headers: getCorsHeaders(request)
    })
  }

  let res = {}
  
  try {
    // 验证内部调用
    const isInternal = request.headers.get('X-Twikoo-Internal') === 'true'
    if (!isInternal) {
      return new Response(JSON.stringify({
        code: RES_CODE.FORBIDDEN,
        message: '禁止直接访问 KV API'
      }), { headers: getCorsHeaders(request) })
    }

    const body = await request.json()
    const { action, data } = body
    
    // 创建数据库操作对象
    const db = createKVDatabase()
    
    switch (action) {
      case 'getComments':
        res = { code: RES_CODE.SUCCESS, data: await db.getComments(data.query || {}) }
        break
      case 'addComment':
        res = { code: RES_CODE.SUCCESS, data: await db.addComment(data.comment) }
        break
      case 'updateComment':
        res = { code: RES_CODE.SUCCESS, data: await db.updateComment(data.id, data.updates) }
        break
      case 'deleteComment':
        res = { code: RES_CODE.SUCCESS, data: await db.deleteComment(data.id) }
        break
      case 'getComment':
        res = { code: RES_CODE.SUCCESS, data: await db.getComment(data.id) }
        break
      case 'bulkAddComments':
        res = { code: RES_CODE.SUCCESS, data: await db.bulkAddComments(data.comments) }
        break
      case 'getConfig':
        res = { code: RES_CODE.SUCCESS, data: await db.getConfig() }
        break
      case 'saveConfig':
        res = { code: RES_CODE.SUCCESS, data: await db.saveConfig(data.config) }
        break
      case 'getCounter':
        res = { code: RES_CODE.SUCCESS, data: await db.getCounter(data.url) }
        break
      case 'incCounter':
        res = { code: RES_CODE.SUCCESS, data: await db.incCounter(data.url, data.title) }
        break
      default:
        res = { code: RES_CODE.FAIL, message: '未知操作' }
    }
  } catch (e) {
    console.error('KV 操作错误：', e.message, e.stack)
    res = { code: RES_CODE.FAIL, message: `KV Error: ${e.message}` }
  }
  
  return new Response(JSON.stringify(res), {
    headers: getCorsHeaders(request)
  })
}

// ==================== CORS 处理 ====================

function handleCors(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  })
}

function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*'
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Twikoo-Internal',
    'Access-Control-Max-Age': '600'
  }
}

// ==================== 工具函数 ====================

function generateUUID() {
  // 使用 Web Crypto API 生成标准 UUID v4（EdgeOne Edge Function 支持）
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') // 移除连字符保持 32 位格式
  }
  // 降级方案：使用 crypto.getRandomValues 获取更高质量的随机数
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // 设置 UUID v4 版本位
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // 保底: 原始实现
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () => {
    return (Math.random() * 16 | 0).toString(16)
  })
}

// ==================== KV 数据库操作层（优化版） ====================

function createKVDatabase() {
  if (typeof TWIKOO_KV === 'undefined') {
    throw new Error('未配置 TWIKOO_KV 命名空间，请在 EdgeOne Pages 控制台绑定 KV 存储')
  }
  
  // 评论缓存（减少重复读取）
  let commentsCache = null
  
  return {
    // 获取所有评论（单次 KV 读取）
    async getAllComments() {
      if (commentsCache !== null) {
        return commentsCache
      }
      const data = await TWIKOO_KV.get(COMMENTS_KEY)
      commentsCache = data ? JSON.parse(data) : []
      return commentsCache
    },
    
    // 保存所有评论
    async saveAllComments(comments) {
      commentsCache = comments
      await TWIKOO_KV.put(COMMENTS_KEY, JSON.stringify(comments))
    },
    
    // 查询评论（支持过滤条件）
    async getComments(query = {}) {
      const allComments = await this.getAllComments()
      return filterComments(allComments, query)
    },
    
    // 添加评论
    async addComment(comment) {
      const id = comment._id || generateUUID()
      comment._id = id
      comment.id = id // 兼容性
      
      const comments = await this.getAllComments()
      comments.push(comment)
      await this.saveAllComments(comments)
      
      return { id }
    },
    
    // 更新评论
    async updateComment(id, updates) {
      const comments = await this.getAllComments()
      const index = comments.findIndex(c => c._id === id)
      
      if (index !== -1) {
        Object.assign(comments[index], updates)
        await this.saveAllComments(comments)
        return { updated: 1 }
      }
      return { updated: 0 }
    },
    
    // 删除评论
    async deleteComment(id) {
      const comments = await this.getAllComments()
      const index = comments.findIndex(c => c._id === id)
      
      if (index !== -1) {
        comments.splice(index, 1)
        await this.saveAllComments(comments)
        return { deleted: 1 }
      }
      return { deleted: 0 }
    },
    
    // 获取单条评论
    async getComment(id) {
      const comments = await this.getAllComments()
      return comments.find(c => c._id === id) || null
    },
    
    // 批量添加评论
    async bulkAddComments(newComments) {
      const comments = await this.getAllComments()
      let insertedCount = 0
      
      for (const comment of newComments) {
        const id = comment._id || generateUUID()
        comment._id = id
        comment.id = id
        comments.push(comment)
        insertedCount++
      }
      
      await this.saveAllComments(comments)
      return insertedCount
    },
    
    // 获取配置
    async getConfig() {
      const data = await TWIKOO_KV.get('config:main')
      return data ? JSON.parse(data) : {}
    },
    
    // 保存配置
    async saveConfig(newConfig) {
      const currentConfig = await this.getConfig()
      const merged = { ...currentConfig, ...newConfig }
      await TWIKOO_KV.put('config:main', JSON.stringify(merged))
      return { updated: 1 }
    },
    
    // 获取计数器
    async getCounter(url) {
      const key = `counter:${encodeURIComponent(url)}`
      const data = await TWIKOO_KV.get(key)
      return data ? JSON.parse(data) : null
    },
    
    // 增加计数器
    async incCounter(url, title) {
      const key = `counter:${encodeURIComponent(url)}`
      let counter = await this.getCounter(url)
      
      if (counter) {
        counter.time = (counter.time || 0) + 1
        counter.title = title
        counter.updated = Date.now()
      } else {
        counter = {
          url,
          title,
          time: 1,
          created: Date.now(),
          updated: Date.now()
        }
      }
      
      await TWIKOO_KV.put(key, JSON.stringify(counter))
      return 1
    }
  }
}

// ==================== 评论过滤函数 ====================

function filterComments(comments, query) {
  if (!Object.keys(query).length) return comments
  
  return comments.filter(comment => {
    for (const [key, value] of Object.entries(query)) {
      if (key === '$or') {
        const orMatch = value.some(condition => {
          return Object.entries(condition).every(([k, v]) => matchCondition(comment, k, v))
        })
        if (!orMatch) return false
      } else if (!matchCondition(comment, key, value)) {
        return false
      }
    }
    return true
  })
}

function matchCondition(comment, key, value) {
  const commentValue = comment[key]
  
  if (value === null || value === undefined) {
    return commentValue === null || commentValue === undefined
  }
  
  if (typeof value === 'object') {
    if ('$in' in value) {
      return value.$in.includes(commentValue)
    }
    if ('$ne' in value) {
      return commentValue !== value.$ne
    }
    if ('$exists' in value) {
      return value.$exists 
        ? (commentValue !== undefined && commentValue !== null && commentValue !== '') 
        : (commentValue === undefined || commentValue === null || commentValue === '')
    }
    if ('$gt' in value) {
      return commentValue > value.$gt
    }
    if ('$lt' in value) {
      return commentValue < value.$lt
    }
    if ('$regex' in value) {
      const regex = new RegExp(value.$regex, value.$options || '')
      return regex.test(commentValue)
    }
  }
  
  return commentValue === value
}

export default { onRequest }

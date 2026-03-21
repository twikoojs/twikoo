const fs = require('fs')
const os = require('os')
const path = require('path')
const { isUrl } = require('.')
const { RES_CODE } = require('./constants')
const { getAxios, getFormData } = require('./lib')
const axios = getAxios()
const FormData = getFormData()
const logger = require('./logger')

const fn = {
  async uploadImage (event, config) {
    const { photo, fileName } = event
    const res = {}
    const imageService = config.IMAGE_CDN
    try {
      if (imageService === 's3') {
        // S3 图床只需要配置相关 S3 参数，不需要 IMAGE_CDN_TOKEN
        if (!config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
          throw new Error('未配置 S3 图床参数（S3_BUCKET、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY）')
        }
      } else if (!imageService || !config.IMAGE_CDN_TOKEN) {
        throw new Error('未配置图片上传服务')
      }
      if (config.NSFW_API_URL) {
        const nsfwResult = await fn.checkNsfw({ photo, config })
        if (nsfwResult.rejected) {
          res.code = RES_CODE.NSFW_REJECTED
          res.err = nsfwResult.message
          return res
        }
      }
      // tip: qcloud 图床走前端上传，其他图床走后端上传
      if (imageService === '7bu') {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: 'https://7bu.top' })
      } else if (imageService === 'see') {
        await fn.uploadImageToSee({ photo, fileName, config, res, imageCdn: 'https://s.ee/api/v1/file/upload' })
      } else if (isUrl(imageService)) {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: imageService })
      } else if (imageService === 'lskypro') {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN_URL })
      } else if (imageService === 'piclist') {
        await fn.uploadImageToPicList({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN_URL })
      } else if (imageService === 'easyimage') {
        await fn.uploadImageToEasyImage({ photo, fileName, config, res })
      } else if (imageService === 'chevereto') {
        await fn.uploadImageToChevereto({ photo, fileName, config, res })
      } else if (imageService === 's3') {
        await fn.uploadImageToS3({ photo, fileName, config, res })
      } else {
        throw new Error('不支持的图片上传服务')
      }
    } catch (e) {
      logger.error(e)
      res.code = RES_CODE.UPLOAD_FAILED
      res.err = e.message
    }
    return res
  },
  async checkNsfw ({ photo, config }) {
    const result = { rejected: false, message: '' }
    try {
      const threshold = parseFloat(config.NSFW_THRESHOLD) || 0.5
      const apiUrl = config.NSFW_API_URL.replace(/\/$/, '')
      const formData = new FormData()
      formData.append('image', fn.base64UrlToReadStream(photo, 'nsfw_check.jpg'))
      const response = await axios.post(`${apiUrl}/classify`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000
      })
      const scores = response.data
      if (scores && typeof scores === 'object') {
        const nsfwScore = (scores.porn || 0) + (scores.hentai || 0) + (scores.sexy || 0)
        logger.info('NSFW检测分数:', nsfwScore, '阈值:', threshold)
        if (nsfwScore > threshold) {
          result.rejected = true
          result.message = `图片包含不当内容，检测分数 ${nsfwScore.toFixed(3)} 超过阈值 ${threshold}`
        }
      }
    } catch (e) {
      logger.error('NSFW检测失败:', e.message)
    }
    return result
  },
  async uploadImageToSee ({ photo, fileName, config, res, imageCdn }) {
    // S.EE 图床 https://s.ee (原 SM.MS)
    const formData = new FormData()
    formData.append('smfile', fn.base64UrlToReadStream(photo, fileName))
    const uploadResult = await axios.post(imageCdn, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: config.IMAGE_CDN_TOKEN
      }
    })
    if (uploadResult.data.success) {
      res.data = uploadResult.data.data
    } else {
      throw new Error(uploadResult.data.message)
    }
  },
  async uploadImageToLskyPro ({ photo, fileName, config, res, imageCdn }) {
    // 自定义兰空图床（v2）URL
    const formData = new FormData()
    formData.append('file', fn.base64UrlToReadStream(photo, fileName))
    if (process.env.TWIKOO_LSKY_STRATEGY_ID) {
      formData.append('strategy_id', parseInt(process.env.TWIKOO_LSKY_STRATEGY_ID))
    }
    const url = `${imageCdn}/api/v1/upload`
    let token = config.IMAGE_CDN_TOKEN
    if (!token.startsWith('Bearer')) {
      token = `Bearer ${token}`
    }
    const uploadResult = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: token
      }
    })
    if (uploadResult.data.status) {
      res.data = uploadResult.data.data
      res.data.url = res.data.links.url
    } else {
      throw new Error(uploadResult.data.message)
    }
  },
  async uploadImageToPicList ({ photo, fileName, config, res, imageCdn }) {
    // PicList https://piclist.cn/ 高效的云存储和图床平台管理工具
    // 鉴权使用 query 参数 key
    const formData = new FormData()
    formData.append('file', fn.base64UrlToReadStream(photo, fileName))
    let url = `${imageCdn}/upload`
    // 如果填写了 key 则拼接 url
    if (config.IMAGE_CDN_TOKEN) {
      url += `?key=${config.IMAGE_CDN_TOKEN}`
    }
    const uploadResult = await axios.post(url, formData)
    if (uploadResult.data.success) {
      res.data = uploadResult.data
      res.data.url = uploadResult.data.result[0]
    } else {
      throw new Error(uploadResult.data.message)
    }
  },
  async uploadImageToEasyImage ({ photo, fileName, config, res }) {
    // EasyImage2.0 https://github.com/icret/EasyImages2.0 简单图床 - 一款功能强大无数据库的图床 2.0版
    try {
      // 参数校验
      if (!config.IMAGE_CDN_URL) {
        throw new Error('未配置 EasyImage2.0 的 API 地址 (IMAGE_CDN_URL)')
      }
      if (!config.IMAGE_CDN_TOKEN) {
        throw new Error('未配置 EasyImage2.0 的 Token (IMAGE_CDN_TOKEN)')
      }
      // 构建固定格式的 FormData
      const formData = new FormData()
      // 添加 token 参数到 Body
      formData.append('token', config.IMAGE_CDN_TOKEN)
      // 添加图片文件（固定参数名 image）
      formData.append('image', fn.base64UrlToReadStream(photo, fileName), {
        filename: fileName
      })
      // 发送请求
      const uploadResult = await axios.post(config.IMAGE_CDN_URL, formData, {
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'Twikoo'
        }
      })
      // 解析响应
      const response = uploadResult.data
      // 检查业务状态码
      if (response.code !== 200 || response.result !== 'success') {
        throw new Error(`API 返回错误 (CODE: ${response.code})`)
      }
      // 提取图片 URL（固定 JSON 路径 url）
      if (!response.url) {
        throw new Error('未找到有效图片 URL')
      }
      // 返回标准化结构
      res.data = {
        url: response.url,
        thumb: response.thumb, // 可选返回缩略图
        del: response.del // 可选返回删除链接
      }
    } catch (e) {
      let errorMsg = `EasyImage2.0 上传失败: ${e.message}`
      // 追加 API 返回的错误详情
      if (e.response?.data) {
        errorMsg += ` | 错误类型: ${e.response.data.message || '未知'}`
      }
      throw new Error(errorMsg)
    }
  },
  async uploadImageToChevereto ({ photo, fileName, config, res }) {
    if (!config.IMAGE_CDN_URL) {
      throw new Error('未配置 Chevereto 站点地址 (IMAGE_CDN_URL)')
    }
    if (!config.IMAGE_CDN_TOKEN) {
      throw new Error('未配置 Chevereto API Key (IMAGE_CDN_TOKEN)')
    }
    const formData = new FormData()
    formData.append('key', config.IMAGE_CDN_TOKEN)
    formData.append('source', fn.base64UrlToReadStream(photo, fileName))
    formData.append('format', 'json')
    const apiUrl = config.IMAGE_CDN_URL.replace(/\/$/, '') + '/api/1/upload'
    const uploadResult = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders()
      }
    })
    const data = uploadResult.data
    if (data.status_code === 200 && data.image && data.image.url) {
      res.data = {
        url: data.image.url,
        thumb: data.image.thumb ? data.image.thumb.url : data.image.url,
        del: data.image.delete_url
      }
    } else {
      const errMsg = (data.error && data.error.message) || JSON.stringify(data)
      throw new Error(`Chevereto 上传失败: ${errMsg}`)
    }
  },
  async uploadImageToS3 ({ photo, fileName, config, res }) {
    // 使用原生 crypto + axios 实现 AWS Signature V4，无需引入 SDK
    if (!config.S3_BUCKET) {
      throw new Error('未配置 S3 存储桶名称 (S3_BUCKET)')
    }
    if (!config.S3_ACCESS_KEY_ID) {
      throw new Error('未配置 S3 Access Key ID (S3_ACCESS_KEY_ID)')
    }
    if (!config.S3_SECRET_ACCESS_KEY) {
      throw new Error('未配置 S3 Secret Access Key (S3_SECRET_ACCESS_KEY)')
    }
    const crypto = require('crypto')
    const region = config.S3_REGION || 'us-east-1'
    // 解析 base64 图片数据
    const base64 = photo.split(';base64,').pop()
    const mimeType = photo.split(';base64,')[0].replace('data:', '') || 'image/webp'
    const body = Buffer.from(base64, 'base64')
    // 构建对象 key
    const prefix = config.S3_PATH_PREFIX ? config.S3_PATH_PREFIX.replace(/\/$/, '') + '/' : ''
    const key = `${prefix}${Date.now()}-${fileName}`
    let endpoint
    if (config.S3_ENDPOINT) {
      // 兼容 R2
      endpoint = `${config.S3_ENDPOINT.replace(/\/$/, '')}/${config.S3_BUCKET}/${key}`
    } else {
      // 标准 AWS S3：virtual-hosted-style URL
      endpoint = `https://${config.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`
    }
    const endpointUrl = new URL(endpoint)
    const host = endpointUrl.host
    const pathname = endpointUrl.pathname
    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex')
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
    const canonicalHeaders = [
      `content-type:${mimeType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`
    ].join('\n') + '\n'
    const canonicalRequest = [
      'PUT',
      pathname,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n')
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n')
    const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest()
    const signingKey = hmac(
      hmac(
        hmac(
          hmac(Buffer.from('AWS4' + config.S3_SECRET_ACCESS_KEY), dateStamp),
          region
        ),
        's3'
      ),
      'aws4_request'
    )
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')
    const authorization = `AWS4-HMAC-SHA256 Credential=${config.S3_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    await axios.put(endpoint, body, {
      headers: {
        'Content-Type': mimeType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization
      },
      maxBodyLength: Infinity
    })
    // 构建访问 URL
    let fileUrl
    if (config.S3_CDN_URL) {
      fileUrl = `${config.S3_CDN_URL.replace(/\/$/, '')}/${key}`
    } else if (config.S3_ENDPOINT) {
      fileUrl = `${config.S3_ENDPOINT.replace(/\/$/, '')}/${config.S3_BUCKET}/${key}`
    } else {
      fileUrl = `https://${config.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`
    }
    res.data = { url: fileUrl }
  },
  base64UrlToReadStream (base64Url, fileName) {
    const base64 = base64Url.split(';base64,').pop()
    const writePath = path.resolve(os.tmpdir(), fileName)
    fs.writeFileSync(writePath, base64, { encoding: 'base64' })
    return fs.createReadStream(writePath)
  }
}

module.exports = fn

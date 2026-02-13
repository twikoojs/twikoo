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
    try {
      if (!config.IMAGE_CDN || !config.IMAGE_CDN_TOKEN) {
        throw new Error('未配置图片上传服务')
      }
      // tip: qcloud 图床走前端上传，其他图床走后端上传
      if (config.IMAGE_CDN === '7bu') {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: 'https://7bu.top' })
      } else if (config.IMAGE_CDN === 'see') {
        await fn.uploadImageToSee({ photo, fileName, config, res, imageCdn: 'https://s.ee/api/v1/file/upload' })
      } else if (isUrl(config.IMAGE_CDN)) {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN })
      } else if (config.IMAGE_CDN === 'lskypro') {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN_URL })
      } else if (config.IMAGE_CDN === 'piclist') {
        await fn.uploadImageToPicList({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN_URL })
      } else if (config.IMAGE_CDN === 'easyimage') {
        await fn.uploadImageToEasyImage({ photo, fileName, config, res })
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
  base64UrlToReadStream (base64Url, fileName) {
    const base64 = base64Url.split(';base64,').pop()
    const writePath = path.resolve(os.tmpdir(), fileName)
    fs.writeFileSync(writePath, base64, { encoding: 'base64' })
    return fs.createReadStream(writePath)
  }
}

module.exports = fn

const fs = require('fs')
const os = require('os')
const path = require('path')
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
      // LskyPro 和 PicList 填写时需要添加前缀 并在下面使用slice去除前缀
      switch (config.IMAGE_CDN) {
        case '7bu':
          await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: 'https://7bu.top' })
          break
        case 'smms':
          await fn.uploadImageToSmms({ photo, fileName, config, res, imageCdn: 'https://smms.app/api/v2/upload' })
          break
        case 'lskypro':
          await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN_URL })
          break
        case 'piclist':
          await fn.uploadImageToPicList({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN_URL })
          break
        default:
          throw new Error('不支持的图片上传服务')
      }
    } catch (e) {
      logger.error(e)
      res.code = RES_CODE.UPLOAD_FAILED
      res.err = e.message
    }
    return res
  },
  async uploadImageToSmms ({ photo, fileName, config, res, imageCdn }) {
    // SM.MS 图床 https://sm.ms
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
    logger.info( photo + fileName )
    // PicList https://piclist.cn/ 高效的云存储和图床平台管理工具
    // 鉴权使用query参数key
    const formData = new FormData()
    formData.append('file', fn.base64UrlToReadStream(photo, fileName))
    let url = `${imageCdn}/upload`
    // 如果填写了key则拼接url
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
  base64UrlToReadStream (base64Url, fileName) {
    const base64 = base64Url.split(';base64,').pop()
    const writePath = path.resolve(os.tmpdir(), fileName)
    fs.writeFileSync(writePath, base64, { encoding: 'base64' })
    return fs.createReadStream(writePath)
  }
}

module.exports = fn

const fs = require('fs')
const os = require('os')
const path = require('path')
const { isUrl } = require('.')
const { RES_CODE } = require('./constants')
const { axios, FormData } = require('./lib')
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
      } else if (config.IMAGE_CDN === 'smms') {
        await fn.uploadImageToSmms({ photo, fileName, config, res })
      } else if (isUrl(config.IMAGE_CDN)) {
        await fn.uploadImageToLskyPro({ photo, fileName, config, res, imageCdn: config.IMAGE_CDN })
      }
    } catch (e) {
      logger.error(e)
      res.code = RES_CODE.UPLOAD_FAILED
      res.err = e.message
    }
    return res
  },
  async uploadImageToSmms ({ photo, fileName, config, res }) {
    // SM.MS 图床 https://sm.ms
    const formData = new FormData()
    formData.append('smfile', fn.base64UrlToReadStream(photo, fileName))
    const uploadResult = await axios.post('https://smms.app/api/v2/upload', formData, {
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
  base64UrlToReadStream (base64Url, fileName) {
    const base64 = base64Url.split(';base64,').pop()
    const writePath = path.resolve(os.tmpdir(), fileName)
    fs.writeFileSync(writePath, base64, { encoding: 'base64' })
    return fs.createReadStream(writePath)
  }
}

module.exports = fn

const fs = require('fs')
const os = require('os')
const path = require('path')
const { RES_CODE } = require('./constants')
const logger = require('./logger')

const fn = {
  async uploadVoice (event, config) {
    const { voice, fileName } = event
    const res = {}
    try {
      if (!config.VOICE_CDN) {
        throw new Error('未配置语音上传服务')
      }

      // 检查必要的配置项
      if (config.VOICE_CDN === 'qcloud') {
        if (!config.VOICE_CDN_TOKEN || !config.VOICE_CDN_SECRET ||
            !config.VOICE_CDN_DOMAIN || !config.VOICE_CDN_REGION || !config.VOICE_CDN_BUCKET) {
          throw new Error('语音上传服务配置不完整，请检查腾讯云对象存储相关配置')
        }
        await fn.uploadVoiceToQcloud({ voice, fileName, config, res })
      } else if (config.VOICE_CDN === 'upyun') {
        if (!config.VOICE_CDN_TOKEN || !config.VOICE_CDN_SECRET ||
            !config.VOICE_CDN_DOMAIN || !config.VOICE_CDN_BUCKET) {
          throw new Error('语音上传服务配置不完整，请检查又拍云相关配置')
        }
        // 又拍云上传逻辑待实现
        throw new Error('又拍云语音上传服务暂未实现')
      } else if (config.VOICE_CDN === 'github') {
        if (!config.VOICE_CDN_TOKEN || !config.VOICE_CDN_DOMAIN || !config.VOICE_CDN_BUCKET) {
          throw new Error('语音上传服务配置不完整，请检查GitHub相关配置')
        }
        // GitHub上传逻辑待实现
        throw new Error('GitHub语音上传服务暂未实现')
      } else {
        throw new Error('不支持的语音上传服务')
      }
    } catch (e) {
      logger.error(e)
      res.code = RES_CODE.UPLOAD_FAILED
      res.err = e.message
      res.message = e.message  // 添加message字段，确保客户端能够正确获取错误信息
    }
    return res
  },
  async uploadVoiceToQcloud ({ voice, fileName, config, res }) {
    // 腾讯云对象存储
    const COS = require('cos-nodejs-sdk-v5')

    // 检查存储桶格式，腾讯云对象存储的存储桶名称应该包含APPID，格式为<bucketname>-<appid>
    const bucketName = config.VOICE_CDN_BUCKET
    if (!bucketName.includes('-')) {
      throw new Error('腾讯云对象存储的存储桶名称格式不正确，应该为<bucketname>-<appid>格式，例如：mybucket-1250000000')
    }

    // 从存储桶名称中提取APPID
    const bucketParts = bucketName.split('-')
    const appid = bucketParts[bucketParts.length - 1]

    // 使用用户提供的腾讯云对象存储信息
    const cos = new COS({
      SecretId: config.VOICE_CDN_TOKEN,
      SecretKey: config.VOICE_CDN_SECRET,
      Domain: config.VOICE_CDN_DOMAIN,
      Region: config.VOICE_CDN_REGION,
      AppId: appid,
      ForcePathStyle: true
    })

    // 生成文件路径
    const filePath = config.VOICE_CDN_PATH || '/twikoo'
    const fullFilePath = `${filePath}/${fileName}`

    // 将base64转换为Buffer
    const base64 = voice.split(';base64,').pop()
    const voiceBuffer = Buffer.from(base64, 'base64')

    return new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: bucketName,
        Region: config.VOICE_CDN_REGION,
        Key: fullFilePath,
        Body: voiceBuffer,
        ContentType: 'audio/wav'
      }, (err, data) => {
        if (err) {
          logger.error('腾讯云对象存储上传失败:', err)
          logger.error('配置信息:', {
            Bucket: bucketName,
            Region: config.VOICE_CDN_REGION,
            Key: fullFilePath,
            Domain: config.VOICE_CDN_DOMAIN,
            ContentType: 'audio/wav',
            FileSize: voiceBuffer.length,
            AppId: appid
          })
          const errorMessage = `语音上传失败: ${err.message || '未知错误'}`
          reject(new Error(errorMessage))
        } else {
          // 构建访问URL
          const url = `https://${bucketName}.${config.VOICE_CDN_DOMAIN}${fullFilePath}`
          res.data = {
            url: url,
            fileName: fileName,
            size: voiceBuffer.length
          }
          resolve(res)
        }
      })
    }).catch(e => {
      // 捕获Promise拒绝的错误，并设置到res对象中
      res.code = RES_CODE.UPLOAD_FAILED
      res.err = e.message
      res.message = e.message
      return res
    })
  },
  base64UrlToReadStream (base64Url, fileName) {
    const base64 = base64Url.split(';base64,').pop()
    const writePath = path.resolve(os.tmpdir(), fileName)
    fs.writeFileSync(writePath, base64, { encoding: 'base64' })
    return fs.createReadStream(writePath)
  }
}

module.exports = fn

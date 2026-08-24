const crypto = require('crypto')

let customLibs = {}

module.exports = {
  setCustomLibs (libs) {
    customLibs = libs
  },
  getHtmlToText () {
    const { compile } = require('html-to-text') // HTML 转纯文本
    return compile({
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' }
      ]
    })
  },
  getAkismetClient () {
    const { AkismetClient } = require('akismet-api') // 反垃圾 API
    return AkismetClient
  },
  getFormData () {
    const FormData = require('form-data') // 图片上传
    return FormData
  },
  getAxios () {
    const axios = require('axios') // 发送 REST 请求
    return axios
  },
  getBowser () {
    const bowser = require('bowser') // UserAgent 格式化
    return bowser
  },
  getDomPurify () {
    if (customLibs.DOMPurify) return customLibs.DOMPurify
    // 初始化反 XSS
    const { JSDOM } = require('jsdom') // document.window 服务器版
    const createDOMPurify = require('dompurify') // 反 XSS
    const window = new JSDOM('').window
    const DOMPurify = createDOMPurify(window)
    return DOMPurify
  },
  getIpToRegion () {
    const ipToRegion = require('@imaegoo/node-ip2region') // IP 属地查询
    return ipToRegion
  },
  getMarked () {
    const marked = require('marked') // Markdown 解析
    return marked
  },
  getMd5 () {
    return (message) => {
      return crypto.createHash('md5').update(String(message)).digest('hex')
    }
  },
  getSha256 () {
    return (message) => {
      return crypto.createHash('sha256').update(message == null ? '' : String(message)).digest('hex')
    }
  },
  getNodemailer () {
    if (customLibs.nodemailer) return customLibs.nodemailer
    const nodemailer = require('nodemailer') // 发送邮件
    return nodemailer
  },
  getPushoo () {
    const pushoo = require('pushoo').default // 即时消息通知
    return pushoo
  },
  getTencentcloudTms () {
    const tencentcloudTms = require('tencentcloud-sdk-nodejs-tms') // 腾讯云文本内容安全 SDK
    return tencentcloudTms
  },
  getXml2js () {
    const xml2js = require('xml2js') // XML 解析
    return xml2js
  }
}

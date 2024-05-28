let customLibs = {}

module.exports = {
  setCustomLibs (libs) {
    customLibs = libs
  },
  getCheerio () {
    const $ = require('cheerio') // jQuery 服务器版
    return $
  },
  getAkismetClient () {
    const { AkismetClient } = require('akismet-api') // 反垃圾 API
    return AkismetClient
  },
  getCryptoJS () {
    const CryptoJS = require('crypto-js') // 编解码
    return CryptoJS
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
    const md5 = require('blueimp-md5') // MD5 哈希
    return md5
  },
  getSha256 () {
    const { SHA256 } = require('crypto-js') // SHA256 哈希
    return (message) => {
      return SHA256(message).toString()
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
  getTencentcloud () {
    const tencentcloud = require('tencentcloud-sdk-nodejs') // 腾讯云 API NODEJS SDK
    return tencentcloud
  },
  getXml2js () {
    const xml2js = require('xml2js') // XML 解析
    return xml2js
  }
}

const $ = require('cheerio') // jQuery 服务器版
const { AkismetClient } = require('akismet-api') // 反垃圾 API
const CryptoJS = require('crypto-js') // 编解码
const FormData = require('form-data') // 图片上传
const { JSDOM } = require('jsdom') // document.window 服务器版
const axios = require('axios') // 发送 REST 请求
const bowser = require('bowser') // UserAgent 格式化
const createDOMPurify = require('dompurify') // 反 XSS
const ipToRegion = require('@imaegoo/node-ip2region') // IP 属地查询
const marked = require('marked') // Markdown 解析
const md5 = require('blueimp-md5') // MD5 加解密
const nodemailer = require('nodemailer') // 发送邮件
const pushoo = require('pushoo').default // 即时消息通知
const tencentcloud = require('tencentcloud-sdk-nodejs') // 腾讯云 API NODEJS SDK
const xml2js = require('xml2js') // XML 解析

function getDomPurify () {
  // 初始化反 XSS
  const window = new JSDOM('').window
  const DOMPurify = createDOMPurify(window)
  return DOMPurify
}

module.exports = {
  $,
  AkismetClient,
  CryptoJS,
  FormData,
  axios,
  bowser,
  getDomPurify,
  ipToRegion,
  marked,
  md5,
  nodemailer,
  pushoo,
  tencentcloud,
  xml2js
}

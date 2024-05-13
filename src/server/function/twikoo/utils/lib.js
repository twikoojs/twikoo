const $ = require('cheerio') // jQuery 服务器版
const { AkismetClient } = require('akismet-api') // 反垃圾 API
const CryptoJS = require('crypto-js') // 编解码
const FormData = require('form-data') // 图片上传
const axios = require('axios') // 发送 REST 请求
const bowser = require('bowser') // UserAgent 格式化
const marked = require('marked') // Markdown 解析
const md5 = require('blueimp-md5') // MD5 加解密
const pushoo = require('pushoo').default // 即时消息通知
const xml2js = require('xml2js') // XML 解析

module.exports = {
  $,
  AkismetClient,
  CryptoJS,
  FormData,
  axios,
  bowser,
  marked,
  md5,
  pushoo,
  xml2js
}

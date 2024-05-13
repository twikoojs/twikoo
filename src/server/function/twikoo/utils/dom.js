const { isInCloudflare } = require('./cloudflare')
const xss = require('xss')

let createDOMPurify, JSDOM

if (!isInCloudflare()) {
  createDOMPurify = require('dompurify') // 反 XSS
  JSDOM = require('jsdom') // document.window 服务器版
}

function getXssPurify () {
  return {
    sanitize(input) {
      return xss(input)
    }
  }
}

function getDomPurify () {
  if (createDOMPurify) {
    // 初始化反 XSS
    const window = new JSDOM('').window
    const DOMPurify = createDOMPurify(window)
    return DOMPurify
  } else {
    return getXssPurify()
  }
}

module.exports = {
  getDomPurify
}

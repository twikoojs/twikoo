const { JSDOM } = require('jsdom') // document.window 服务器版
const createDOMPurify = require('dompurify') // 反 XSS

function getDomPurify () {
  // 初始化反 XSS
  const window = new JSDOM('').window
  const DOMPurify = createDOMPurify(window)
  return DOMPurify
}

module.exports = {
  getDomPurify
}

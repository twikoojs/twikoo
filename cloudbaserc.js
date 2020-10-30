const fs = require('fs')

let envId
try {
  envId = fs.readFileSync('./envId.txt').toString().trim()
} catch (e) {
  throw new Error('无法读取环境id，请先配置 envId.txt - https://twikoo.js.org/quick-start.html')
}

const defaultFunctionConfig = {
  // 超时时间
  timeout: 10,
  // 环境变量
  envVariables: {},
  runtime: 'Nodejs10.15',
  // 内存 128
  memorySize: 128,
  handler: 'index.main'
}

module.exports = {
  envId: envId,
  functionRoot: './src/function',
  functions: [
    { name: 'comment-get', ...defaultFunctionConfig },
    { name: 'comment-like', ...defaultFunctionConfig },
    { name: 'comment-submit', ...defaultFunctionConfig },
    { name: 'counter-get', ...defaultFunctionConfig }
  ]
}

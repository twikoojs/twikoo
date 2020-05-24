const { config } = require('./_config')

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
  envId: config.envId,
  functionRoot: './src/func',
  functions: [
    { name: 'migrate', ...defaultFunctionConfig }
  ]
}

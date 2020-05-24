const config = require('./_config')

module.exports = {
  envId: config.envId,
  functionRoot: './functions',
  functions: [
    {
      name: 'app',
      // 超时时间
      timeout: 5,
      // 环境变量
      envVariables: {},
      runtime: 'Nodejs10.15',
      // 内存 128
      memorySize: 128,
      handler: 'index.main'
    }
  ]
}

const { program } = require('commander')
const { join } = require('node:path')
const { existsSync, writeFileSync } = require('node:fs')
const { getAsset, isSea, getAssetKeys } = require('node:sea')
const { name, dependencies } = require('./package.json')

program
  .name(name)
  .version(dependencies.tkserver, '-v, --version')
  .description(
    `DESCRIPTION:
  Official website: https://twikoo.js.org/`
  )
  .helpCommand(false)

program.parse(process.argv)

const envPath = join(__dirname, '.env')

// SEA 打包场景：若内置了 .env 资源，首次启动时释放到 exe 同目录，
// 方便用户直接编辑配置
if (isSea() && getAssetKeys().includes('.env') && !existsSync(envPath)) {
  writeFileSync(envPath, getAsset('.env', 'utf8'))
}

// .env 存在则加载（不覆盖已有环境变量，与 dotenv 默认行为一致）
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath)
  } catch (e) {
    console.error(`Failed to load ${envPath}:`, e.message)
  }
}

// 适配iis
if (
  isSea() &&
  getAssetKeys().includes('web.config') &&
  process.platform === 'win32' &&
  !existsSync(join(__dirname, './web.config'))
) {
  writeFileSync(join(__dirname, './web.config'), getAsset('web.config', 'utf8'))
}

// 匹配iis
if (
  isSea() &&
  getAssetKeys().includes('web.config') &&
  process.platform === 'win32' &&
  existsSync(join(__dirname, './web.config')) &&
  process.env.ASPNETCORE_PORT
) {
  process.env.TWIKOO_PORT = process.env.ASPNETCORE_PORT
  process.env.TWIKOO_LOCALHOST_ONLY = undefined
}

require('tkserver')

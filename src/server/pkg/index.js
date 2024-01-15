const { program } = require('commander')
const { join } = require('path')
const { existsSync, writeFileSync, readFileSync } = require('fs')

program
  .name(require('./package.json').name)
  .version(require('./package.json').dependencies.tkserver, '-v, --version')
  .description(
    `DESCRIPTION:
  Official website: https://twikoo.js.org/`
  )
  .addHelpCommand(false)

program.parse(process.argv)

// 创建.env文件
if (
  process.pkg &&
  !existsSync(join(process.execPath, '..', '.env')) &&
  existsSync(join(__dirname, '.env'))
) {
  writeFileSync(
    join(process.execPath, '..', '.env'),
    readFileSync(join(__dirname, '.env'), 'utf-8')
  )
}

// 适配iis
if (
  process.pkg &&
  process.platform === 'win32' &&
  !existsSync(join(process.execPath, '..', './web.config')) &&
  existsSync(join(__dirname, './web.config'))
) {
  writeFileSync(
    join(process.execPath, '..', './web.config'),
    readFileSync(join(__dirname, './web.config'), 'utf-8')
  )
}

// 获取env
require('dotenv').config({
  path:
    process.pkg && existsSync(join(process.execPath, '..', '.env'))
      ? join(process.execPath, '..', '.env')
      : existsSync(join(__dirname, '.env'))
        ? join(__dirname, '.env')
        : undefined
})

// 匹配iis
if (process.env.ASPNETCORE_PORT) {
  process.env.TWIKOO_PORT = process.env.ASPNETCORE_PORT
  process.env.TWIKOO_LOCALHOST_ONLY = null
}

require('tkserver')

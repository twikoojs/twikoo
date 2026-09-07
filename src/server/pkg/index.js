const { program } = require('commander')
const { join } = require('node:path')
const { existsSync, readFileSync, writeFileSync } = require('node:fs')
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

// SEA 打包场景：若内置了资源，首次启动时释放到 exe 同目录，
// 方便用户直接编辑配置。释放失败（如 exe 位于只读目录）只报告错误，不终止启动。
function extractAsset (assetPath, targetPath) {
  if (!isSea() || !getAssetKeys().includes(assetPath) || existsSync(targetPath)) return
  try {
    writeFileSync(targetPath, getAsset(assetPath, 'utf8'))
  } catch (e) {
    console.error(`Failed to extract ${assetPath} to ${targetPath}:`, e.message)
  }
}

// 解析 .env 并覆盖到 process.env，保持与之前 dotenv override: true 一致的行为
// （process.loadEnvFile 不会覆盖已有环境变量）。仅支持 KEY=VALUE / 注释 / 引号格式。
function loadEnvFile (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) process.env[key] = value
  }
}

// 释放 SEA 内置资源
extractAsset('.env', envPath)
if (process.platform === 'win32') {
  extractAsset('web.config', join(__dirname, 'web.config'))
}

// .env 存在则加载，.env 中的值覆盖已有环境变量（与之前 dotenv override: true 行为一致）
if (existsSync(envPath)) {
  try {
    loadEnvFile(envPath)
  } catch (e) {
    console.error(`Failed to load ${envPath}:`, e.message)
  }
}

// 匹配iis：ASPNETCORE_PORT 由 IIS/ASP.NET Core Module 注入，
// 映射不依赖 SEA / Windows / web.config，node index.js 等启动方式同样生效
if (process.env.ASPNETCORE_PORT) {
  process.env.TWIKOO_PORT = process.env.ASPNETCORE_PORT
  process.env.TWIKOO_LOCALHOST_ONLY = undefined
}

require('tkserver')

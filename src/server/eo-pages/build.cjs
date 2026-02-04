/**
 * Twikoo EdgeOne Pages 构建脚本
 * 
 * 处理不兼容包的覆写，类似 Cloudflare 版本的处理方式
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const srcDir = __dirname

console.log('Twikoo EdgeOne Pages 构建脚本')
console.log('==============================')
console.log('')

// 步骤 0: 生成 ip2region 数据文件
console.log('步骤 0: 生成 ip2region 数据文件...')
const ip2regionDbPath = path.join(srcDir, 'node_modules/@imaegoo/node-ip2region/data/ip2region.db')
const ip2regionOutputPath = path.join(srcDir, 'node-functions/ip2region-data.js')

if (fs.existsSync(ip2regionDbPath)) {
  const dbBuffer = fs.readFileSync(ip2regionDbPath)
  console.log(`  原始大小: ${(dbBuffer.length / 1024 / 1024).toFixed(2)} MB`)
  
  const compressed = zlib.gzipSync(dbBuffer, { level: 9 })
  console.log(`  压缩后大小: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`)
  
  const base64 = compressed.toString('base64')
  
  const jsContent = `/**
 * ip2region.db 数据（gzip 压缩 + Base64 编码）
 * 自动生成，请勿手动修改
 * 原始大小: ${(dbBuffer.length / 1024 / 1024).toFixed(2)} MB
 * 压缩后: ${(compressed.length / 1024 / 1024).toFixed(2)} MB
 */
import pako from 'pako'

const IP2REGION_DATA_BASE64 = '${base64}'

let _cachedBuffer = null

export function getIp2RegionBuffer() {
  if (_cachedBuffer === null) {
    // 将 Base64 转换为 Uint8Array
    const binaryString = atob(IP2REGION_DATA_BASE64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    // 使用 pako 解压（纯 JS 实现，不依赖 Node.js zlib）
    _cachedBuffer = Buffer.from(pako.ungzip(bytes))
  }
  return _cachedBuffer
}

export default getIp2RegionBuffer
`
  
  fs.writeFileSync(ip2regionOutputPath, jsContent)
  console.log(`  ✓ 已生成: node-functions/ip2region-data.js (${(fs.statSync(ip2regionOutputPath).size / 1024 / 1024).toFixed(2)} MB)`)
} else {
  console.log(`  ✗ ip2region.db 不存在，跳过生成`)
  console.log(`    请先运行: npm install @imaegoo/node-ip2region`)
}
console.log('')

// 需要覆写的不兼容包（EdgeOne Node Function 不支持这些包）
const packagesToOverwrite = [
  // jsdom 依赖 canvas，Node Function 不支持
  'node_modules/jsdom/lib/api.js',
  // tencentcloud-sdk 体积大且不兼容
  'node_modules/tencentcloud-sdk-nodejs/tencentcloud/index.js',
  // nodemailer 在某些环境下有兼容性问题
  'node_modules/nodemailer/lib/nodemailer.js',
]

console.log('步骤 1: 覆写不兼容的包...')
let overwriteCount = 0
for (const pkg of packagesToOverwrite) {
  const filePath = path.join(srcDir, pkg)
  if (fs.existsSync(filePath)) {
    // 备份原文件（如果还没备份）
    const backupPath = filePath + '.backup'
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath)
    }
    // 覆写为空模块
    fs.writeFileSync(filePath, '// Overwritten for EdgeOne Pages compatibility\nmodule.exports = {};\n')
    console.log(`  ✓ 已覆写: ${pkg}`)
    overwriteCount++
  } else {
    console.log(`  - 跳过（不存在）: ${pkg}`)
  }
}
console.log(`  共覆写 ${overwriteCount} 个文件`)
console.log('')

// 检查必要文件
console.log('步骤 2: 检查项目文件...')
const requiredFiles = [
  'node-functions/index.js',
  'node-functions/ip2region-searcher.js',
  'node-functions/ip2region-data.js',
  'edge-functions/api/kv.js',
  'package.json'
]

let allFilesExist = true
for (const file of requiredFiles) {
  const filePath = path.join(srcDir, file)
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${file}`)
  } else {
    console.log(`  ✗ ${file} (缺失)`)
    allFilesExist = false
  }
}

console.log('')
if (allFilesExist) {
  console.log('构建完成！所有文件已就绪。')
  console.log('')
  console.log('项目结构：')
  console.log('  node-functions/index.js            - Node Function 主入口')
  console.log('  node-functions/ip2region-searcher.js - IP 归属地查询器')
  console.log('  node-functions/ip2region-data.js   - IP 数据库（自动生成）')
  console.log('  edge-functions/api/kv.js           - Edge Function KV API')
  console.log('')
  console.log('部署说明：')
  console.log('  1. 在 EdgeOne Pages 控制台创建项目')
  console.log('  2. 创建 KV 命名空间并绑定，变量名：TWIKOO_KV')
  console.log('  3. 推送代码触发部署')
} else {
  console.log('错误：部分必要文件缺失，请检查项目结构')
  process.exit(1)
}

/**
 * ip2region 纯内存查询器
 * (c) 2025-present Mintimate
 * 不依赖 fs 模块，适用于 EdgeOne Pages Node Function
 * 
 * 基于 @imaegoo/node-ip2region 的 memorySearchSync 方法改写
 */

import { getIp2RegionBuffer } from './ip2region-data.js'

const INDEX_BLOCK_LENGTH = 12

/**
 * 将 IP 地址转换为长整型
 */
function ip2long(ip) {
  const arr = ip.split('.')
  if (arr.length !== 4) {
    throw new Error('invalid ip')
  }
  const IP_BASE = [16777216, 65536, 256, 1]
  return arr.reduce((val, n, i) => {
    n = Number(n)
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new Error('invalid ip')
    }
    return val + IP_BASE[i] * n
  }, 0)
}

/**
 * 从 Buffer 中读取 32 位无符号整数（小端序）
 */
function getLong(buffer, offset) {
  const val =
    (buffer[offset] & 0x000000ff) |
    ((buffer[offset + 1] << 8) & 0x0000ff00) |
    ((buffer[offset + 2] << 16) & 0x00ff0000) |
    ((buffer[offset + 3] << 24) & 0xff000000)
  return val < 0 ? val >>> 0 : val
}

// 缓存的数据库 Buffer 和索引信息
let dbBuffer = null
let firstIndexPtr = 0
let lastIndexPtr = 0
let totalBlocks = 0

/**
 * 初始化数据库
 */
function initDatabase() {
  if (dbBuffer !== null) return

  dbBuffer = getIp2RegionBuffer()
  firstIndexPtr = getLong(dbBuffer, 0)
  lastIndexPtr = getLong(dbBuffer, 4)
  totalBlocks = ((lastIndexPtr - firstIndexPtr) / INDEX_BLOCK_LENGTH) | 0 + 1
}

/**
 * 搜索 IP 地址的归属地信息
 * @param {string} ip - IPv4 地址
 * @returns {{ city: number, region: string } | null}
 */
export function searchSync(ip) {
  // 初始化数据库
  initDatabase()

  // 将 IP 转换为长整型
  let ipLong
  try {
    ipLong = ip2long(ip)
  } catch (e) {
    return null
  }

  let l = 0
  let h = totalBlocks
  let sip = 0
  let m = 0
  let p = 0

  while (l <= h) {
    m = (l + h) >> 1
    p = (firstIndexPtr + m * INDEX_BLOCK_LENGTH) | 0

    sip = getLong(dbBuffer, p)

    if (ipLong < sip) {
      h = m - 1
    } else {
      sip = getLong(dbBuffer, p + 4)
      if (ipLong > sip) {
        l = m + 1
      } else {
        sip = getLong(dbBuffer, p + 8)
        // not matched
        if (sip === 0) return null

        // get the data
        const dataLen = ((sip >> 24) & 0xff) | 0
        const dataPtr = (sip & 0x00ffffff) | 0
        const city = getLong(dbBuffer, dataPtr)

        const bufArray = []
        for (let startPos = dataPtr + 4, i = startPos; i < startPos + dataLen - 4; ++i) {
          bufArray.push(dbBuffer[i])
        }
        const region = Buffer.from(bufArray).toString()
        return { city, region }
      }
    }
  }

  return null
}

/**
 * 获取 IP 属地（简化版）
 * @param {string} ip - IPv4 地址
 * @param {boolean} detail - 是否返回详细信息
 * @returns {string} 归属地字符串
 */
export function getIpRegion(ip, detail = false) {
  if (!ip) return ''

  try {
    // 将 IPv6 格式的 IPv4 地址转换为 IPv4 格式
    ip = ip.replace(/^::ffff:/, '')
    // 去掉端口号
    ip = ip.replace(/:[0-9]*$/, '')

    const result = searchSync(ip)
    if (!result || !result.region) return ''

    // region 格式: 中国|0|广东省|深圳市|电信
    const [country, , province, city, isp] = result.region.split('|')

    // 有省显示省，没有省显示国家
    const area = province && province.trim() && province !== '0' ? province : country

    if (detail) {
      return area === city ? [city, isp].join(' ') : [area, city, isp].join(' ')
    } else {
      return area.replace(/(省|市)$/, '')
    }
  } catch (e) {
    console.warn('IP 属地查询失败：', e.message, ip)
    return ''
  }
}

export default {
  searchSync,
  getIpRegion
}

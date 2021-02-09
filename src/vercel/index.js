/*!
 * Twikoo vercel function v0.0.1-alpha
 * (c) 2020-2021 iMaeGoo
 * Released under the MIT License.
 */

// 三方依赖 / 3rd party dependencies
const url = require('url')
const MongoClient = require('mongodb').MongoClient

// 常量 / constants
const VERSION = '0.0.1-alpha'
const RES_CODE = {
  SUCCESS: 0,
  FAIL: 1000,
  EVENT_NOT_EXIST: 1001,
  PASS_EXIST: 1010,
  CONFIG_NOT_EXIST: 1020,
  CREDENTIALS_NOT_EXIST: 1021,
  CREDENTIALS_INVALID: 1025,
  PASS_NOT_EXIST: 1022,
  PASS_NOT_MATCH: 1023,
  NEED_LOGIN: 1024,
  FORBIDDEN: 1403,
  AKISMET_ERROR: 1030
}

// 全局变量 / variables
let db = null

module.exports = async (req, response) => {
  console.log('请求方法：', req.event)
  console.log('请求参数：', req)
  let res = {}
  await connectToDatabase(process.env.MONGODB_URI)
  // await readConfig()
  try {
    switch (req.event) {
      case 'GET_FUNC_VERSION':
        res = getFuncVersion()
        break
      default:
        if (req.event) {
          res.code = RES_CODE.EVENT_NOT_EXIST
          res.message = '请更新 Twikoo 云函数至最新版本'
        } else {
          res.code = RES_CODE.SUCCESS
          res.message = 'Twikoo 云函数运行正常，请参考 https://twikoo.js.org/quick-start.html#%E5%89%8D%E7%AB%AF%E9%83%A8%E7%BD%B2 完成前端的配置'
        }
    }
  } catch (e) {
    console.error('Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/imaegoo/twikoo/issues')
    console.error('请求参数：', req)
    console.error('错误信息：', e)
    res.code = RES_CODE.FAIL
    res.message = e.message
  }
  console.log('请求返回：', res)
  response.status(200).json(res)
}

// 获取 Twikoo 云函数版本
function getFuncVersion () {
  return {
    code: RES_CODE.SUCCESS,
    version: VERSION
  }
}

// A function for connecting to MongoDB,
// taking a single parameter of the connection string
async function connectToDatabase (uri) {
  // If the database connection is cached,
  // use it instead of creating a new connection
  if (db) return db
  // If no connection is cached, create a new one
  const client = await MongoClient.connect(uri, { useNewUrlParser: true })
  // Select the database through the connection,
  // using the database path of the connection string
  db = await client.db(url.parse(uri).pathname.substr(1))
  // Cache the database connection and return the connection
  return db
}

// 请求参数校验
function validate (event = {}, requiredParams = []) {
  for (const requiredParam of requiredParams) {
    if (!event[requiredParam]) {
      throw new Error(`参数"${requiredParam}"不合法`)
    }
  }
}

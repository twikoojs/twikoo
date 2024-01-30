/**
 * Deta 兼容 Vercel 函数实现
 * 复用 Twikoo Vercel 函数代码
 */

const twikoo = require('twikoo-vercel')
const express = require('express')
const app = express()

// Tip: Deta 本身无法获取评论者 IP，需要使用 Cloudflare CDN 才能获取评论者 IP。
// Docs: https://deta.space/docs/en/build/guides/accessing-client-ip-address
process.env.TWIKOO_IP_HEADERS = JSON.stringify(['headers.cf-connecting-ip'])

app.use(async function (req, res) {
  const buffers = []
  req.on('data', (chunk) => {
    buffers.push(chunk)
  })
  req.on('end', async () => {
    try {
      req.body = JSON.parse(Buffer.concat(buffers).toString())
    } catch (e) {
      req.body = {}
    }
    res.status = function (code) {
      res.statusCode = code
      return this
    }
    res.json = function (json) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json')
        res.status(200).send(JSON.stringify(json))
      }
      return this
    }
    return await twikoo(req, res)
  })
})

app.listen(8080)

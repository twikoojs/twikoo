#!/usr/bin/env node

const http = require('http')
const twikoo = require('./index')
const server = http.createServer()

server.on('request', async function (request, response) {
  try {
    const buffers = []
    for await (const chunk of request) {
      buffers.push(chunk)
    }
    request.body = JSON.parse(Buffer.concat(buffers).toString())
  } catch (e) {
    console.error(e.message)
    request.body = {}
  }
  response.status = function (code) {
    this.statusCode = code
    return this
  }
  response.json = function (json) {
    if (!response.writableEnded) {
      this.writeHead(200, { 'Content-Type': 'application/json' })
      this.end(JSON.stringify(json))
    }
    return this
  }
  return await twikoo(request, response)
})

const port = parseInt(process.env.TWIKOO_PORT) || 8080

server.listen(port, function () {
  console.log(`Twikoo function started on port ${port}`)
})

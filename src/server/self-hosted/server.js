#!/usr/bin/env node

const http = require('http')
const logger = require('twikoo-func/utils/logger')

const dbUrl = process.env.MONGODB_URI || process.env.MONGO_URL || null
const twikoo = dbUrl ? require('./mongo') : require('./index')
const server = http.createServer()

server.on('request', async function (request, response) {
  try {
    const buffers = []
    for await (const chunk of request) {
      buffers.push(chunk)
    }
    request.body = JSON.parse(Buffer.concat(buffers).toString())
  } catch (e) {
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
const host = process.env.TWIKOO_LOCALHOST_ONLY === 'true' ? 'localhost' : '::'

server.listen(port, host, function () {
  logger.info(`Twikoo is using ${dbUrl ? 'mongo' : 'loki'} database`)
  logger.info(`Twikoo function started on host ${host} port ${port}`)
})

#!/usr/bin/env node

const http = require('http')
const logger = require('twikoo-func/utils/logger')

const dbUrl = process.env.MONGODB_URI || process.env.MONGO_URL || null
const twikoo = dbUrl ? require('./mongo') : require('./index')
const server = http.createServer()
const sockets = new Set()
const TWIKOO_SHUTDOWN_TIMEOUT = parseInt(process.env.TWIKOO_SHUTDOWN_TIMEOUT) || 5000
let isShuttingDown = false
let shuttingDownPromise = null

server.on('request', async function (request, response) {
  if (isShuttingDown) {
    response.writeHead(503, {
      Connection: 'close',
      'Content-Type': 'application/json'
    })
    response.end(JSON.stringify({ code: 503, message: 'Twikoo server is shutting down' }))
    return
  }
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

server.on('connection', (socket) => {
  sockets.add(socket)
  socket.on('close', () => sockets.delete(socket))
})

const port = parseInt(process.env.TWIKOO_PORT) || 8080
const host = process.env.TWIKOO_HOST || (process.env.TWIKOO_LOCALHOST_ONLY === 'true' ? 'localhost' : '::')

server.listen(port, host, function () {
  logger.info(`Twikoo is using ${dbUrl ? 'mongo' : 'loki'} database`)
  logger.info(`Twikoo function started on host ${host} port ${port}`)
})

function closeServer () {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

function destroySockets () {
  for (const socket of sockets) {
    socket.destroy()
  }
}

async function shutdownWithTimeout () {
  let timeoutId
  const closeTask = closeServer()
  const timeoutTask = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      logger.warn(`Twikoo server shutdown timed out after ${TWIKOO_SHUTDOWN_TIMEOUT}ms, destroying open connections`)
      destroySockets()
      resolve()
    }, TWIKOO_SHUTDOWN_TIMEOUT)
  })
  await Promise.race([closeTask, timeoutTask])
  clearTimeout(timeoutId)
  await closeTask
}

async function runShutdown (signal) {
  isShuttingDown = true
  logger.info(`Received ${signal}, shutting down Twikoo server...`)
  try {
    await shutdownWithTimeout()
  } catch (e) {
    logger.error('Twikoo HTTP server shutdown failed:', e)
  } finally {
    if (typeof twikoo.shutdown === 'function') {
      await twikoo.shutdown()
    }
  }
  logger.info('Twikoo server stopped')
}

async function shutdown (signal) {
  if (!shuttingDownPromise) {
    shuttingDownPromise = runShutdown(signal)
  }
  return await shuttingDownPromise
}

async function handleSignal (signal) {
  try {
    await shutdown(signal)
    process.exitCode = 0
  } catch (e) {
    logger.error('Twikoo server shutdown failed:', e)
    process.exitCode = 1
  }
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

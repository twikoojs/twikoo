const twikoo = require('twikoo-vercel')

/*
AWS Lambda compat layer for Vercel
https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
*/

exports.handler = async function (event, context) {
  process.env.VERCEL_URL = event.requestContext.domainName
  process.env.TWIKOO_IP_HEADERS = JSON.stringify([
    'headers.requestContext.http.sourceIp'
  ])
  const result = {
    statusCode: 204,
    headers: {},
    body: ''
  }
  const request = {
    method: event.requestContext.http.method,
    headers: event.headers,
    body: {}
  }
  try {
    if (event.isBase64Encoded) {
      request.body = JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
    } else {
      request.body = JSON.parse(event.body)
    }
  } catch (e) {}
  const response = {
    status: function (code) {
      result.statusCode = code
      return this
    },
    json: function (json) {
      result.headers['Content-Type'] = 'application/json'
      result.body = JSON.stringify(json)
      return this
    },
    end: function () {
      return this
    },
    setHeader: function (k, v) {
      result.headers[k] = v
      return this
    }
  }
  await twikoo(request, response)
  return result
}

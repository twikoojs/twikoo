const {
  getAkismetClient,
  getCryptoJS,
  getTencentcloud,
  getOpenAIClient
} = require('./lib')
const {
  equalsMail
} = require('.')
const AkismetClient = getAkismetClient()
const CryptoJS = getCryptoJS()

const logger = require('./logger')

let tencentcloud
let openai
let _openaiApiKey
let _openaiEndpoint

function getTencentCloud () {
  if (!tencentcloud) {
    try {
      tencentcloud = getTencentcloud() // 腾讯云 API NODEJS SDK
    } catch (e) {
      logger.warn('加载 "tencentcloud-sdk-nodejs" 失败', e)
    }
  }
  return tencentcloud
}

function getOpenAI (config) {
  if (isConfigChanged(config)) {
    _openaiApiKey = config.LLM_API_KEY || ''
    _openaiEndpoint = config.LLM_API_ENDPOINT || ''
    openai = getOpenAIClient(config)
  }
  return openai
}

function isConfigChanged (config) {
  return !openai ||
    _openaiApiKey !== (config.LLM_API_KEY || '') ||
    _openaiEndpoint !== (config.LLM_API_ENDPOINT || '')
}

// 提取json结构的函数
function extractJson (rawText) {
  if (!rawText) return ''
  const trimmed = rawText.trim()
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match ? match[0] : trimmed
}

// 移除多余的字符
function repairJson (jsonStr) {
  if (!jsonStr) return ''
  let cleaned = jsonStr.trim()
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
  return cleaned
}

// validateJson 返回的 error 信息会被拼接进 prompt
function validateJson (jsonStr) {
  try {
    const obj = JSON.parse(jsonStr)
    if (typeof obj !== 'object' || obj === null) {
      return { valid: false, error: 'Parsed JSON is not an object' }
    }
    if (!('spam' in obj)) {
      return { valid: false, error: 'Missing required key "spam"' }
    }
    if (typeof obj.spam !== 'boolean') {
      return { valid: false, error: 'Key "spam" must be a boolean value' }
    }
    return { valid: true, data: obj }
  } catch (err) {
    return { valid: false, error: `JSON Parse failed: ${err.message}` }
  }
}

// 生成提示词的函数: system 为管理员指令，user 为待审核的评论数据
// errorMsg 用于重试，customPrompt 替代默认的 system 指令
function buildMessages (commentData, errorMsg = '', customPrompt = '') {
  // 1. system 指令（管理员自定义或内置默认）
  const systemContent = customPrompt || `You are a blog comment moderation assistant. Analyze ALL fields below and determine if this submission is spam or ham.

Spam includes ANY of the following in ANY field:
- Commercial ads, promotions, or buying/selling offers (e.g., "代开发票", "加微信", "兼职", "办证", "AI中转站").
- Special case: If the comment text is harmless, but the nickname is suspicious (e.g., contains ads or promotions) AND a website link is provided, treat it as SPAM.
- Meaningless gibberish or spammy repetition (e.g., "顶顶顶", "111111", "asdfgh", "好" repeated).
- Abusive language, insults, or offensive Chinese slang.
- Suspicious links or SEO spam in the website field.
- Bot-like automated greetings.

Ham includes:
- Genuine questions, constructive feedback, technical discussions, or normal greetings in Chinese/English.

Strictly follow these rules:
1. If ANY field contains spam content, output exactly {"spam": true}.
2. If ALL fields are legitimate, output exactly {"spam": false}.
3. Do not include any explanations, introduction, punctuation, or extra spaces. Output only the JSON object.

Your response MUST be a single valid JSON object, like:
{"spam": true} or {"spam": false}`

  // 2. user 数据（始终是待审核的评论内容）
  let userContent = `Comment: ${commentData.comment}
Nickname: ${commentData.nick || ''}
Website: ${commentData.link || ''}`

  // 3. 如果有错误信息，追加到用户消息末尾
  if (errorMsg) {
    userContent += `\n\n[ERROR FROM PREVIOUS ATTEMPT]: Your last response failed verification with error: "${errorMsg}". Please correct your output format and make sure to return exactly valid JSON.`
  }

  // 4. 返回 messages 数组
  const finalPrompt = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent }
  ]
  logger.log('提示词是：', finalPrompt)
  return finalPrompt
}

async function checkByLLM (comment, config) {
  const maxRetries = config.LLM_MAX_RETRIES || 3
  let lastError = ''

  const openai = getOpenAI(config)

  // 网络/Provider 异常或者格式校验不通过会进入重试逻辑
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    try {
      let messages
      // 自定义提示词和内置提示词的 message 构建逻辑全交给 buildMessages 函数
      if (config.LLM_SPAM_PROMPT) {
        messages = buildMessages(comment, lastError, config.LLM_SPAM_PROMPT)
      } else {
        messages = buildMessages(comment, lastError)
      }

      const chatCompletion = await openai.chat.completions.create({
        model: config.LLM_MODEL || 'deepseek-v4-pro',
        response_format: { type: 'json_object' },
        messages
      })

      const rawText = chatCompletion.choices[0].message.content || ''

      const extracted = extractJson(rawText)
      const repaired = repairJson(extracted)
      const validation = validateJson(repaired)

      // 校验通过返回，不通过继续循环
      if (validation.valid) {
        const isSpam = validation.data.spam
        if (isSpam) {
          logger.info(`LLM 判定为 SPAM (尝试第 ${attempt} 次): id="${comment.id}" nick="${comment.nick}"`)
        } else {
          logger.log(`LLM 判定为 HAM (尝试第 ${attempt} 次): id="${comment.id}" nick="${comment.nick}"`)
        }
        return isSpam
      } else {
        lastError = validation.error
        logger.warn(`LLM 返回校验失败 (尝试第 ${attempt}/${maxRetries} 次), 错误: ${lastError}. 原始返回: "${rawText}"`)
      }
    } catch (error) {
      lastError = error.message
      logger.error(`LLM 请求异常 (尝试第 ${attempt}/${maxRetries} 次), 错误: ${lastError}`)
    }
  }

  logger.error(`LLM 垃圾评论检测历经 ${maxRetries} 次尝试均失败，执行终极放行兜底（返回 false）`)
  return false
}

const fn = {
  // 后垃圾评论检测
  async postCheckSpam (comment, config) {
    try {
      let isSpam
      if (comment.isSpam) {
        // 预检测没过的，就不再检测了
        isSpam = true
      } else if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
        // 博主本人评论，不再检测了
        isSpam = false
      } else if (config.QCLOUD_SECRET_ID && config.QCLOUD_SECRET_KEY) {
        // 腾讯云内容安全
        const client = new (getTencentCloud().tms.v20201229.Client)({
          credential: { secretId: config.QCLOUD_SECRET_ID, secretKey: config.QCLOUD_SECRET_KEY },
          region: 'ap-shanghai',
          profile: { httpProfile: { endpoint: 'tms.tencentcloudapi.com' } }
        })
        const textModerationParams = {
          // 文档: https://cloud.tencent.com/document/api/1124/51860
          Content: CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(comment.comment)),
          DataId: comment.id,
          User: { Nickname: comment.nick },
          Device: { IP: comment.ip }
        }
        if (config.QCLOUD_CMS_BIZTYPE) {
          textModerationParams.BizType = config.QCLOUD_CMS_BIZTYPE
        }
        logger.log('腾讯云请求参数：', textModerationParams)
        const checkResult = await client.TextModeration(textModerationParams)
        logger.log('腾讯云返回结果：', checkResult)
        isSpam = checkResult.Suggestion !== 'Pass'
      } else if (config.AKISMET_KEY) {
        // Akismet
        const akismetClient = new AkismetClient({
          key: config.AKISMET_KEY,
          blog: config.SITE_URL
        })
        const isValid = await akismetClient.verifyKey()
        if (!isValid) {
          logger.warn('Akismet key 不可用：', config.AKISMET_KEY)
          return
        }
        isSpam = await akismetClient.checkSpam({
          user_ip: comment.ip,
          user_agent: comment.ua,
          permalink: comment.href,
          comment_type: comment.rid ? 'reply' : 'comment',
          comment_author: comment.nick,
          comment_author_email: comment.mail,
          comment_author_url: comment.link,
          comment_content: comment.comment
        })
      } else if (config.LLM_API_KEY) {
        // 大语言模型检测
        isSpam = await checkByLLM(comment, config)
      }
      logger.log('垃圾评论检测结果：', isSpam)
      return isSpam
    } catch (err) {
      logger.error('垃圾评论检测异常：', err)
    }
  }
}

module.exports = fn

const {
  getAkismetClient,
  getCryptoJS,
  getTencentcloud,
  getOpenAI
} = require('./lib')
const {
  equalsMail
} = require('.')
const AkismetClient = getAkismetClient()
const CryptoJS = getCryptoJS()

const logger = require('./logger')

let tencentcloud

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

async function checkByLLM (comment, config) {
  const defaultPrompt = (c) => `You are a blog comment moderation assistant. Analyze ALL fields below and determine if this submission is spam or ham.

Spam includes ANY of the following in ANY field:
- Commercial ads, promotions, or buying/selling offers (e.g., "代开发票", "加微信", "兼职", "办证").
- Meaningless gibberish or spammy repetition (e.g., "顶顶顶", "111111", "asdfgh", "好" repeated).
- Abusive language, insults, or offensive Chinese slang.
- Suspicious links or SEO spam in the website field.
- Bot-like automated greetings.

Ham includes:
- Genuine questions, constructive feedback, technical discussions, or normal greetings in Chinese/English.

---
Comment: ${c.comment}
Nickname: ${c.nick || ''}
Website: ${c.link || ''}
---

Strictly follow these rules:
1. If ANY field contains spam content, output exactly "SPAM".
2. If ALL fields are legitimate, output exactly "HAM".
3. Do not include any explanations, introduction, punctuation, or extra spaces. Output only ONE word.`
  try {
    const OpenAI = getOpenAI()
    const openai = new OpenAI({
      apiKey: config.LLM_API_KEY,
      baseURL: config.LLM_API_ENDPOINT || 'https://api.deepseek.com'
    })
    const content = config.LLM_SPAM_PROMPT
      ? config.LLM_SPAM_PROMPT
        .replace('{{comment}}', comment.comment)
        .replace('{{nick}}', comment.nick || '')
        .replace('{{link}}', comment.link || '')
      : defaultPrompt(comment)

    const chatCompletion = await openai.chat.completions.create({
      model: config.LLM_MODEL || 'deepseek-v4-pro',
      messages: [{ role: 'user', content }]
    })
    const answer = (chatCompletion.choices[0].message.content || '').trim().toUpperCase()
    if (answer.includes('SPAM')) {
      logger.info(`LLM 判定为 SPAM: id="${comment.id}" nick="${comment.nick}"`)
    }
    return answer.includes('SPAM')
  } catch (error) {
    logger.error('LLM 垃圾评论检测失败，错误信息:', error)
    return false
  }
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

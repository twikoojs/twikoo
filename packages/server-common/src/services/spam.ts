/**
 * 反垃圾与验证码服务（1.x utils/spam.js + utils/index.js 的 captcha/limit 部分
 * 语义对齐）。
 *
 * 链路（COMMENT_SUBMIT）：
 * 1. preCheckSpam 预检（长度 / 屏蔽词 / 人工审核标记 / 违禁词）——同步快速路径；
 * 2. checkCaptcha 验证码（Turnstile / Geetest / Cap 内嵌或外部）；
 * 3. limitFilter 频率限制（单 IP 与全站 10 分钟窗口）；
 * 4. postCheckSpam 后检（腾讯云 TMS / Akismet / Jev / LLM，postSubmit 异步阶段）。
 */
import { createHmac } from "node:crypto";
import type { Capabilities } from "../ports/capabilities";
import type { CommentDoc, ConfigData, Database } from "../ports/database";
import type { RequestLogger } from "../utils/logger";
// lib-loader 静态导入即可（惰性在它内部完成，见其头注释「消费方约定」）
import { httpPost } from "../utils/http";
import {
  getAkismetClient,
  getFormData,
  getGenerateText,
  getTencentcloudTms,
} from "../utils/lib-loader";
import { GT } from "../ports/database";
import { equalsMail } from "./comment-dto";

/**
 * 预垃圾评论检测（1.x preCheckSpam 逐行对齐）。
 * @param comment 待检评论字段
 * @param config 全量配置
 * @param logger 请求日志
 * @returns 是否标记为垃圾（MANUAL_REVIEW / 违禁词）
 */
export function preCheckSpam(
  comment: { comment: string; nick: string; link?: string; mail?: string },
  config: ConfigData,
  logger: RequestLogger,
): boolean {
  // 长度限制
  let limitLength = parseInt(String(config.LIMIT_LENGTH ?? ""));
  if (Number.isNaN(limitLength)) limitLength = 500;
  if (limitLength && comment.comment.length > limitLength) {
    throw new Error("评论内容过长");
  }
  if (config.BLOCKED_WORDS) {
    const commentLowerCase = comment.comment.toLowerCase();
    const nickLowerCase = comment.nick.toLowerCase();
    for (const blockedWord of String(config.BLOCKED_WORDS).split(",")) {
      const blockedWordLowerCase = blockedWord.trim().toLowerCase();
      if (
        commentLowerCase.indexOf(blockedWordLowerCase) !== -1 ||
        nickLowerCase.indexOf(blockedWordLowerCase) !== -1
      ) {
        throw new Error("包含屏蔽词");
      }
    }
  }
  if (config.AKISMET_KEY === "MANUAL_REVIEW") {
    // 人工审核
    logger.info("已使用人工审核模式，评论审核后才会发表~");
    return true;
  } else if (config.FORBIDDEN_WORDS) {
    // 违禁词检测
    const commentLowerCase = comment.comment.toLowerCase();
    const nickLowerCase = comment.nick.toLowerCase();
    const linkLowerCase = (comment.link || "").toLowerCase();
    const mailLowerCase = (comment.mail || "").toLowerCase();
    for (const forbiddenWord of String(config.FORBIDDEN_WORDS).replace(/,+$/, "").split(",")) {
      const forbiddenWordLowerCase = forbiddenWord.trim().toLowerCase();
      if (
        commentLowerCase.indexOf(forbiddenWordLowerCase) !== -1 ||
        nickLowerCase.indexOf(forbiddenWordLowerCase) !== -1 ||
        linkLowerCase.indexOf(forbiddenWordLowerCase) !== -1 ||
        mailLowerCase.indexOf(forbiddenWordLowerCase) !== -1
      ) {
        logger.warn("包含违禁词，直接标记为垃圾评论~");
        return true;
      }
    }
  }
  return false;
}

/**
 * Turnstile 验证码检测（1.x checkTurnstileCaptcha 对齐）。
 * @param params 验证参数
 */
export async function checkTurnstileCaptcha(params: {
  caps: Capabilities;
  ip: string;
  turnstileToken: string;
  turnstileTokenSecretKey: string;
}): Promise<void> {
  try {
    const FormData = await getFormData(params.caps);
    const formData = new FormData();
    formData.append("secret", params.turnstileTokenSecretKey);
    formData.append("response", params.turnstileToken);
    formData.append("remoteip", params.ip);
    const response = await httpPost(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      formData,
      {
        headers: (formData as unknown as { getHeaders(): Record<string, string> }).getHeaders(),
      },
    );
    const data = response.data as { success?: boolean };
    if (!data.success) throw new Error("验证码错误");
  } catch (e) {
    throw new Error(`验证码检测失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Geetest v4 验证码检测（1.x checkGeeTestCaptcha 对齐：HMAC-SHA256 签名）。
 * @param params 验证参数
 */
export async function checkGeeTestCaptcha(params: {
  geeTestCaptchaId: string;
  geeTestCaptchaKey: string;
  geeTestLotNumber: string;
  geeTestCaptchaOutput: string;
  geeTestPassToken: string;
  geeTestGenTime: string;
}): Promise<void> {
  try {
    const signToken = createHmac("sha256", params.geeTestCaptchaKey)
      .update(params.geeTestLotNumber)
      .digest("hex");
    const search = new URLSearchParams({
      lot_number: params.geeTestLotNumber,
      captcha_output: params.geeTestCaptchaOutput,
      pass_token: params.geeTestPassToken,
      gen_time: params.geeTestGenTime,
      sign_token: signToken,
    });
    const url = `https://gcaptcha4.geetest.com/validate?captcha_id=${params.geeTestCaptchaId}`;
    const response = await httpPost(url, search.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = response.data as { result?: string; reason?: string; msg?: string };
    if (data.result !== "success") {
      throw new Error(data.reason || data.msg || "验证码错误");
    }
  } catch (e) {
    throw new Error(`极验验证码检测失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Cap 验证码检测（内嵌 validateToken 或外部 Standalone siteverify，1.x 对齐）。
 * @param params 验证参数（cap 为内嵌 Cap 实例）
 * @param validateToken 内嵌 Cap 的 token 校验函数
 */
export async function checkCapCaptcha(
  params: {
    capToken: string;
    capSecretKey?: string;
    capApiEndpoint?: string;
    cap?: unknown;
  },
  validateToken?: (cap: unknown, token: string) => Promise<boolean>,
): Promise<void> {
  try {
    // 内嵌 Cap：直接 validateToken，无需外部 Standalone
    if (params.cap) {
      if (!validateToken) throw new Error("内嵌 Cap 未初始化");
      const ok = await validateToken(params.cap, params.capToken);
      if (!ok) throw new Error("验证码错误");
      return;
    }
    // 外部 Cap Standalone：HTTP siteverify
    const endpoint = (params.capApiEndpoint ?? "").replace(/\/$/, "");
    const response = await httpPost(
      `${endpoint}/siteverify`,
      { secret: params.capSecretKey, response: params.capToken },
      { headers: { "Content-Type": "application/json" } },
    );
    const data = response.data as { success?: boolean; error?: string };
    if (!data.success) throw new Error(data.error || "验证码错误");
  } catch (e) {
    throw new Error(`Cap验证码检测失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * 发表频率限制（1.x limitFilter 对齐：单 IP 与全站 10 分钟窗口计数）。
 * @param options 限流入参
 */
export async function limitFilter(options: {
  db: Database;
  config: ConfigData;
  ip: string;
}): Promise<void> {
  const { db, config, ip } = options;
  // 限制每个 IP 每 10 分钟发表的评论数量
  let limitPerMinute = parseInt(String(config.LIMIT_PER_MINUTE ?? ""));
  if (Number.isNaN(limitPerMinute)) limitPerMinute = 10;
  if (limitPerMinute) {
    const count = await db.countComments({
      ip,
      created: { [GT]: Date.now() - 600000 },
    });
    if (count > limitPerMinute) {
      throw new Error("发言频率过高");
    }
  }
  // 限制所有 IP 每 10 分钟发表的评论数量
  let limitPerMinuteAll = parseInt(String(config.LIMIT_PER_MINUTE_ALL ?? ""));
  if (Number.isNaN(limitPerMinuteAll)) limitPerMinuteAll = 10;
  if (limitPerMinuteAll) {
    const count = await db.countComments({
      created: { [GT]: Date.now() - 600000 },
    });
    if (count > limitPerMinuteAll) {
      throw new Error("评论太火爆啦 >_< 请稍后再试");
    }
  }
}

/**
 * 提取模型返回中的 JSON 片段（1.x extractJson 对齐）。
 * @param rawText 模型原始返回
 * @returns JSON 片段
 */
function extractJson(rawText: string): string {
  if (!rawText) return "";
  const trimmed = rawText.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

/**
 * 修复模型返回 JSON 的尾逗号（1.x repairJson 对齐）。
 * @param jsonStr JSON 片段
 * @returns 修复后文本
 */
function repairJson(jsonStr: string): string {
  if (!jsonStr) return "";
  return jsonStr.trim().replace(/,\s*([}\]])/g, "$1");
}

/**
 * 构建垃圾判定消息（1.x buildMessages 对齐：system 指令 + user 评论数据 + 重试错误）。
 * @param commentData 评论数据
 * @param errorMsg 上次校验错误（重试用）
 * @param customPrompt 管理员自定义指令
 * @returns messages 数组
 */
function buildMessages(
  commentData: { comment?: string; nick?: string; link?: string },
  errorMsg = "",
  customPrompt = "",
): Array<{ role: string; content: string }> {
  const systemContent =
    customPrompt ||
    `You are a blog comment moderation assistant. Analyze ALL fields below and determine if this submission is spam or ham.

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
{"spam": true} or {"spam": false}`;

  let userContent = `Comment: ${commentData.comment}
Nickname: ${commentData.nick || ""}
Website: ${commentData.link || ""}`;

  if (errorMsg) {
    userContent += `\n\n[ERROR FROM PREVIOUS ATTEMPT]: Your last response failed verification with error: "${errorMsg}". Please correct your output format and make sure to return exactly valid JSON.`;
  }

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}

/**
 * Jev 垃圾检测（System One noul 概率判定）。
 *
 * 使用固定问题让 Jev 判断整条评论是否为垃圾内容；state 同时包含正文、昵称和网址，
 * 避免「正文正常但昵称/网址是推广」这类软广告漏判。
 *
 * @param comment 评论数据
 * @param config 全量配置
 * @param logger 请求日志
 * @returns 是否垃圾；响应格式异常时抛错，由 postCheckSpam 统一降级为 undefined
 */
async function checkByJev(
  comment: CommentDoc,
  config: ConfigData,
  logger: RequestLogger,
): Promise<boolean> {
  const endpoint = String(config.JEV_API_ENDPOINT || "https://api.typesafe.ai/v1/systemone");
  const model = String(config.JEV_MODEL || "jev-latest");
  const configuredThreshold = Number(config.JEV_SPAM_THRESHOLD);
  const threshold =
    config.JEV_SPAM_THRESHOLD !== undefined &&
    config.JEV_SPAM_THRESHOLD !== "" &&
    Number.isFinite(configuredThreshold) &&
    configuredThreshold >= 0 &&
    configuredThreshold <= 1
      ? configuredThreshold
      : 0.85;

  const response = await httpPost<{
    model?: string;
    answers?: {
      spam?: {
        type?: string;
        noul?: number;
      };
    };
  }>(
    endpoint,
    {
      model,
      state: {
        comment: comment.comment || "",
        nickname: comment.nick || "",
        website: comment.link || "",
      },
      questions: {
        spam: {
          type: "noul",
          instructions: `
Is this submission spam for a personal blog?

Evaluate the comment text, nickname, and website together.

Treat the submission as spam when it contains or represents:
- Unsolicited commercial advertisements or promotions.
- SEO spam, link-building spam, marketing, or lead-generation services.
- Scams, gambling, adult services, or financial promotions.
- Meaningless repetitive content or automated promotional greetings.
- Generic praise, thanks, or greetings when the nickname or website clearly represents a commercial, SEO, marketing, or promotional service.

Important:
- A harmless-looking comment does not make the submission legitimate if the nickname or website is primarily being used for promotion.
- Do not judge only the comment text. Consider nickname and website as equally important signals.
- Do not penalize genuine personal blogs, developer websites, project pages, or personal homepages when the comment contains relevant, substantive discussion or normal community interaction.

Treat genuine questions, technical discussions, constructive feedback, relevant experience sharing, and normal greetings from ordinary users as not spam.
`.trim(),
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${String(config.JEV_API_KEY)}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    },
  );

  const score = response.data?.answers?.spam?.noul;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error("Jev 返回格式不合法：缺少 answers.spam.noul");
  }

  const isSpam = score >= threshold;
  logger.info(
    `Jev 判定为 ${isSpam ? "SPAM" : "HAM"} (score=${score.toFixed(4)}, threshold=${threshold}, model="${response.data.model || model}")`,
  );
  return isSpam;
}

/**
 * LLM 垃圾检测（1.x checkByLLM 对齐：重试 + JSON 校验 + 失败放行兜底）。
 * @param comment 评论数据
 * @param config 全量配置
 * @param caps 平台能力声明（ai）
 * @param logger 请求日志
 * @returns 是否垃圾；历经重试仍失败时放行（false）
 */
async function checkByLLM(
  comment: CommentDoc,
  config: ConfigData,
  caps: Capabilities,
  logger: RequestLogger,
): Promise<boolean> {
  const maxRetries = Number(config.LLM_MAX_RETRIES) || 3;
  let lastError = "";
  let generateText: ((options: unknown) => Promise<{ text?: string }>) | null = null;
  void caps;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      if (!generateText) {
        // @xsai/generate-text 为 ai 能力外部依赖：惰性在 lib-loader 内部完成
        generateText = await getGenerateText(caps);
      }
      const messages = buildMessages(comment, lastError, String(config.LLM_SPAM_PROMPT ?? ""));
      const chatCompletion = await generateText?.({
        apiKey: config.LLM_API_KEY,
        baseURL: config.LLM_API_ENDPOINT || "https://api.deepseek.com/v1",
        model: config.LLM_MODEL || "deepseek-chat",
        responseFormat: { type: "json_object" },
        messages,
      });
      const rawText = chatCompletion?.text ?? "";
      let parsed: { spam?: unknown };
      try {
        parsed = JSON.parse(repairJson(extractJson(rawText)));
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(`LLM 返回校验失败 (尝试第 ${attempt}/${maxRetries} 次)`);
        continue;
      }
      if (typeof parsed === "object" && parsed !== null && typeof parsed.spam === "boolean") {
        logger.info(`LLM 判定为 ${parsed.spam ? "SPAM" : "HAM"} (第 ${attempt} 次)`);
        return parsed.spam;
      }
      lastError = 'Key "spam" must be a boolean value';
      logger.warn(`LLM 返回校验失败 (尝试第 ${attempt}/${maxRetries} 次)`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.error(`LLM 请求异常 (尝试第 ${attempt}/${maxRetries} 次), 错误: ${lastError}`);
    }
  }
  logger.error(`LLM 垃圾评论检测历经 ${maxRetries} 次尝试均失败，执行终极放行兜底（返回 false）`);
  return false;
}

/**
 * 后垃圾评论检测（1.x postCheckSpam 链路对齐基础上扩展：博主豁免 → 腾讯云 →
 * Akismet → Jev → LLM；异常不阻断主流程）。
 * @param options 检测入参
 * @returns 是否垃圾；无法判定时 undefined（1.x 兼容）
 */
export async function postCheckSpam(options: {
  comment: CommentDoc;
  config: ConfigData;
  caps: Capabilities;
  logger: RequestLogger;
}): Promise<boolean | undefined> {
  const { comment, config, caps, logger } = options;
  try {
    let isSpam: boolean | undefined;
    if (comment.isSpam) {
      // 预检测没过的，就不再检测了
      isSpam = true;
    } else if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
      // 博主本人评论，不再检测了
      isSpam = false;
    } else if (config.QCLOUD_SECRET_ID && config.QCLOUD_SECRET_KEY) {
      // 腾讯云内容安全
      const tencentcloudTms = await getTencentcloudTms(caps);
      const ClientCtor = (
        tencentcloudTms.tms as {
          v20201229: {
            Client: new (options: unknown) => {
              TextModeration(
                p: unknown,
              ): Promise<{ Suggestion?: string; Label?: string; SubLabel?: string }>;
            };
          };
        } as never as {
          v20201229: {
            Client: new (options: unknown) => {
              TextModeration(
                p: unknown,
              ): Promise<{ Suggestion?: string; Label?: string; SubLabel?: string }>;
            };
          };
        }
      ).v20201229.Client;
      const client = new ClientCtor({
        credential: {
          secretId: config.QCLOUD_SECRET_ID,
          secretKey: config.QCLOUD_SECRET_KEY,
        },
        region: "ap-shanghai",
        profile: { httpProfile: { endpoint: "tms.tencentcloudapi.com" } },
      });
      const checkResult = await client.TextModeration({
        // 文档: https://cloud.tencent.com/document/api/1124/51860
        Content: Buffer.from(String(comment.comment ?? ""), "utf8").toString("base64"),
        DataId: comment._id,
        User: { Nickname: comment.nick },
        Device: { IP: comment.ip },
        ...(config.QCLOUD_CMS_BIZTYPE ? { BizType: config.QCLOUD_CMS_BIZTYPE } : {}),
      });
      isSpam = checkResult.Suggestion !== "Pass";
      if (isSpam) {
        logger.warn(
          `腾讯云判定不通过: id="${comment._id}" nick="${comment.nick}" suggestion="${checkResult.Suggestion}" label="${checkResult.Label}" subLabel="${checkResult.SubLabel}"`,
        );
      }
    } else if (config.AKISMET_KEY) {
      // Akismet
      const AkismetClient = await getAkismetClient(caps);
      const akismetClient = new AkismetClient({
        key: config.AKISMET_KEY,
        blog: config.SITE_URL,
      });
      const isValid = await (
        akismetClient as unknown as { verifyKey(): Promise<boolean> }
      ).verifyKey();
      if (!isValid) {
        logger.warn("Akismet key 不可用：", config.AKISMET_KEY);
        return undefined;
      }
      isSpam = await akismetClient.checkSpam({
        user_ip: comment.ip,
        user_agent: comment.ua,
        permalink: comment.href,
        comment_type: comment.rid ? "reply" : "comment",
        comment_author: comment.nick,
        comment_author_email: comment.mail,
        comment_author_url: comment.link,
        comment_content: comment.comment,
      });
    } else if (config.JEV_API_KEY) {
      // Jev / System One 概率检测
      isSpam = await checkByJev(comment, config, logger);
    } else if (config.LLM_API_KEY) {
      // 大语言模型检测
      isSpam = await checkByLLM(comment, config, caps, logger);
    }
    logger.verbose("垃圾评论检测结果：", isSpam);
    return isSpam;
  } catch (err) {
    logger.error("垃圾评论检测异常：", err);
    return undefined;
  }
}

/**
 * 保存垃圾检测结果（1.x saveSpamCheckResult 对齐：判定为垃圾才回写）。
 * 2.0 差异说明：postSubmit 收到的评论已带 _id（保存阶段回填），按 _id 精确
 * 回写；1.x 按 created 回写是历史形态，行为等价但可能误伤同毫秒文档。
 * @param db 数据库
 * @param comment 评论（携带 _id）
 * @param isSpam 判定结果
 */
export async function saveSpamCheckResult(
  db: Database,
  comment: CommentDoc,
  isSpam: boolean | undefined,
): Promise<void> {
  if (isSpam !== undefined) comment.isSpam = isSpam;
  if (isSpam && comment._id) {
    await db.updateComment(comment._id, {
      isSpam,
      updated: Date.now(),
    });
  }
}

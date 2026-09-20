/**
 * 通知服务（1.x utils/notify.js 逐行语义对齐）。
 *
 * 三路并发：博主邮件（noticeMaster）/ 回复邮件（noticeReply）/
 * 即时消息（noticePushoo，pushoo 20 渠道）。邮件传输器经库加载器
 * 惰性装载（mail 能力 + setCustomLibs 覆写支持）。
 */
import type { Capabilities } from "../ports/capabilities";
import type { CommentDoc, ConfigData } from "../ports/database";
import type { RequestLogger } from "../utils/logger";
import type { NodemailerLike } from "../utils/lib-loader";
import { getHtmlToText, getNodemailer, getPushoo } from "../utils/lib-loader";
import { RES_CODE } from "../utils/constants";
import { toStr } from "../utils/safe-str";
import { equalsMail, getAvatar, isValidEmail } from "./comment-dto";

/**
 * HTML 实体转义（1.x escapeHtml 对齐：仅在渲染邮件时转义，防止邮件模板
 * 存储型 XSS；不改数据库内容）。
 * @param str 原文
 * @returns 转义后文本
 */
function escapeHtml(str: unknown): string {
  if (typeof str !== "string") return toStr(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 已初始化的邮件传输器（进程级缓存；emailTest 前重置） */
let transporter: ReturnType<NodemailerLike["createTransport"]> | null = null;

/**
 * 初始化邮件插件（1.x initMailer 对齐：SMTP_SERVICE 或 SMTP_HOST 两种形态）。
 * @param options 初始化选项
 * @param caps 平台能力声明
 * @param logger 请求日志
 * @returns 是否初始化成功
 */
export async function initMailer(options: {
  config: ConfigData;
  throwErr?: boolean;
  caps: Capabilities;
  logger: RequestLogger;
}): Promise<boolean> {
  const { config, throwErr = false, caps, logger } = options;
  try {
    if (!config || !config.SMTP_USER || !config.SMTP_PASS) {
      throw new Error("数据库配置不存在");
    }
    /** nodemailer 传输配置 */
    const transportConfig: Record<string, unknown> = {
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    };
    if (config.SMTP_SERVICE) {
      transportConfig.service = config.SMTP_SERVICE;
    } else if (config.SMTP_HOST) {
      transportConfig.host = config.SMTP_HOST;
      transportConfig.port = parseInt(String(config.SMTP_PORT));
      transportConfig.secure = config.SMTP_SECURE === "true";
    } else {
      throw new Error("SMTP 服务器没有配置");
    }
    const nodemailer = await getNodemailer(caps);
    transporter = nodemailer.createTransport(transportConfig);
    try {
      const success = await (transporter as unknown as { verify(): Promise<unknown> }).verify();
      if (success) logger.info("SMTP 邮箱配置正常");
    } catch (error) {
      throw new Error(
        `SMTP 邮箱配置异常：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (throwErr) {
      logger.error("邮件初始化异常：", message);
      throw e;
    }
    logger.warn("邮件初始化异常：", message);
    return false;
  }
}

/**
 * 拼接评论定位 URL 的 hash（1.x appendHashToUrl 对齐）。
 * @param url 页面地址
 * @param hash 评论 id
 * @returns 带 hash 的地址
 */
function appendHashToUrl(url: string, hash: unknown): string {
  if (url.indexOf("#") === -1) {
    return `${url}#${String(hash)}`;
  }
  return `${url.substring(0, url.indexOf("#"))}#${String(hash)}`;
}

/**
 * 博主通知（1.x noticeMaster 逐行对齐：模板变量替换 + IM 推送互斥逻辑）。
 * @param options 通知入参
 */
async function noticeMaster(options: {
  comment: CommentDoc;
  config: ConfigData;
  caps: Capabilities;
  logger: RequestLogger;
}): Promise<unknown> {
  const { comment, config, caps, logger } = options;
  if (!transporter && !(await initMailer({ config, caps, logger }))) {
    logger.info("未配置邮箱或邮箱配置有误，不通知");
    return undefined;
  }
  if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
    logger.info("博主本人评论，不发送通知给博主");
    return undefined;
  }
  // 判断是否存在即时消息推送配置
  const hasIMPushConfig = config.PUSHOO_CHANNEL && config.PUSHOO_TOKEN;
  if (hasIMPushConfig && config.SC_MAIL_NOTIFY !== "true") {
    logger.info("存在即时消息推送配置，默认不发送邮件给博主，您可以在管理面板修改此行为");
    return undefined;
  }
  const SITE_NAME = toStr(config.SITE_NAME);
  const NICK = escapeHtml(comment.nick);
  const IMG = getAvatar(comment, config);
  const IP = toStr(comment.ip);
  const MAIL = escapeHtml(comment.mail);
  const COMMENT = toStr(comment.comment);
  const SITE_URL = config.SITE_URL;
  const POST_URL = escapeHtml(
    appendHashToUrl(toStr(comment.href) || `${SITE_URL}${toStr(comment.url)}`, comment._id),
  );
  const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`;
  let emailContent: unknown;
  if (config.MAIL_TEMPLATE_ADMIN) {
    emailContent = String(config.MAIL_TEMPLATE_ADMIN)
      .replace(/\$\{SITE_URL\}/g, String(SITE_URL))
      .replace(/\$\{SITE_NAME\}/g, String(SITE_NAME))
      .replace(/\$\{NICK\}/g, String(NICK))
      .replace(/\$\{IMG\}/g, String(IMG))
      .replace(/\$\{IP\}/g, String(IP))
      .replace(/\$\{MAIL\}/g, String(MAIL))
      .replace(/\$\{COMMENT\}/g, String(COMMENT))
      .replace(/\$\{POST_URL\}/g, String(POST_URL));
  } else {
    emailContent = `
        <div style="border-top:2px solid #12addb;box-shadow:0 1px 3px #aaaaaa;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
          <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
            您在<a style="text-decoration:none;color: #12addb;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的文章有了新的评论
          </h2>
          <p><strong>${NICK}</strong>回复说：</p>
          <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
          <p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a><br></p>
        </div>`;
  }
  const toMail = config.BLOGGER_EMAIL || config.SENDER_EMAIL;
  if (!isValidEmail(toMail)) {
    logger.warn("博主邮箱格式不合法，跳过发送博主通知：", toMail);
    return undefined;
  }
  let sendResult: unknown;
  try {
    sendResult = await transporter?.sendMail({
      from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
      to: toMail,
      subject: emailSubject,
      html: emailContent,
    });
  } catch (e) {
    sendResult = e;
  }
  logger.verbose("博主通知结果：", sendResult);
  return sendResult;
}

/**
 * 即时消息推送内容获取（1.x getIMPushContent 对齐）。
 * @param comment 评论
 * @param config 全量配置
 * @returns 推送载荷（subject/content/url）
 */
export async function getIMPushContent(
  comment: CommentDoc,
  config: ConfigData,
): Promise<{ subject: string; content: string; url: string }> {
  const SITE_NAME = toStr(config.SITE_NAME);
  const NICK = escapeHtml(comment.nick);
  const MAIL = escapeHtml(comment.mail);
  const IP = toStr(comment.ip);
  const htmlToText = await getHtmlToText();
  const COMMENT = htmlToText(toStr(comment.comment));
  const SITE_URL = toStr(config.SITE_URL);
  const POST_URL = escapeHtml(
    appendHashToUrl(toStr(comment.href) || `${SITE_URL}${toStr(comment.url)}`, comment._id),
  );
  const subject: string = toStr(config.MAIL_SUBJECT_ADMIN) || `${SITE_NAME}有新评论了`;
  const content = `评论人：${NICK} ([${MAIL}](mailto:${MAIL}))

评论人IP：${IP}

评论内容：${COMMENT}

原文链接：[${POST_URL}](${POST_URL})`;
  return { subject, content, url: POST_URL };
}

/**
 * 即时消息通知（1.x noticePushoo 对齐：pushoo 渠道推送，bark 附 url）。
 * @param options 通知入参
 */
async function noticePushoo(options: {
  comment: CommentDoc;
  config: ConfigData;
  logger: RequestLogger;
}): Promise<void> {
  const { comment, config, logger } = options;
  if (!config.PUSHOO_CHANNEL || !config.PUSHOO_TOKEN) {
    logger.info("没有配置 pushoo，放弃即时消息通知");
    return;
  }
  if (equalsMail(config.BLOGGER_EMAIL, comment.mail)) {
    logger.info("博主本人评论，不发送通知给博主");
    return;
  }
  const pushContent = await getIMPushContent(comment, config);
  // pushoo 由适配器按通知能力安装，运行时动态加载（变量间接保证零静态解析）
  const pushoo = await getPushoo();
  const sendResult = await pushoo(String(config.PUSHOO_CHANNEL), {
    token: config.PUSHOO_TOKEN,
    title: pushContent.subject,
    content: pushContent.content,
    options: {
      bark: {
        url: pushContent.url,
      },
    },
  });
  logger.info("即时消息通知结果：", sendResult);
}

/**
 * 回复通知（1.x noticeReply 逐行对齐：父评论缺失/博主/自回复豁免 + 模板变量）。
 * @param options 通知入参（getParentComment 由调用方以 db 闭包提供）
 */
async function noticeReply(options: {
  currentComment: CommentDoc;
  config: ConfigData;
  caps: Capabilities;
  logger: RequestLogger;
  getParentComment: (comment: CommentDoc) => Promise<CommentDoc | null>;
}): Promise<unknown> {
  const { currentComment, config, caps, logger, getParentComment } = options;
  if (!currentComment.pid) {
    logger.info("无父级评论，不通知");
    return undefined;
  }
  if (!transporter && !(await initMailer({ config, caps, logger }))) {
    logger.info("未配置邮箱或邮箱配置有误，不通知");
    return undefined;
  }
  const parentComment = await getParentComment(currentComment);
  if (!parentComment) return undefined;
  if (equalsMail(config.BLOGGER_EMAIL, parentComment.mail)) {
    logger.info("回复给博主，因为会发博主通知邮件，所以不再重复通知");
    return undefined;
  }
  if (equalsMail(currentComment.mail, parentComment.mail)) {
    logger.info("回复自己的评论，不邮件通知");
    return undefined;
  }
  const PARENT_NICK = escapeHtml(parentComment.nick);
  const IMG = getAvatar(currentComment, config);
  const PARENT_IMG = getAvatar(parentComment, config);
  const SITE_NAME = toStr(config.SITE_NAME);
  const NICK = escapeHtml(currentComment.nick);
  const COMMENT = toStr(currentComment.comment);
  const PARENT_COMMENT = toStr(parentComment.comment);
  const POST_URL = escapeHtml(
    appendHashToUrl(
      String(currentComment.href || `${config.SITE_URL}${currentComment.url}`),
      currentComment._id,
    ),
  );
  const SITE_URL = config.SITE_URL;
  const emailSubject =
    config.MAIL_SUBJECT || `${toStr(PARENT_NICK)}，您在『${SITE_NAME}』上的评论收到了回复`;
  let emailContent: unknown;
  if (config.MAIL_TEMPLATE) {
    emailContent = String(config.MAIL_TEMPLATE)
      .replace(/\$\{IMG\}/g, String(IMG))
      .replace(/\$\{PARENT_IMG\}/g, String(PARENT_IMG))
      .replace(/\$\{SITE_URL\}/g, String(SITE_URL))
      .replace(/\$\{SITE_NAME\}/g, String(SITE_NAME))
      .replace(/\$\{PARENT_NICK\}/g, String(PARENT_NICK))
      .replace(/\$\{PARENT_COMMENT\}/g, String(PARENT_COMMENT))
      .replace(/\$\{NICK\}/g, String(NICK))
      .replace(/\$\{COMMENT\}/g, String(COMMENT))
      .replace(/\$\{POST_URL\}/g, String(POST_URL));
  } else {
    emailContent = `
        <div style="border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;">
          <h2 style="border-bottom:1px solid #dddddd;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
            您在<a style="text-decoration:none;color: #12ADDB;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的评论有了新的回复
          </h2>
          ${PARENT_NICK} 同学，您曾发表评论：
          <div style="padding:0 12px 0 12px;margin-top:18px">
            <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${PARENT_COMMENT}</div>
            <p><strong>${NICK}</strong>回复说：</p>
            <div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">${COMMENT}</div>
            <p>
              您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a>，
              欢迎再次光临<a style="text-decoration:none; color:#12addb" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>。<br>
            </p>
          </div>
        </div>`;
  }
  if (!isValidEmail(parentComment.mail)) {
    logger.warn("回复通知邮箱格式不合法，跳过发送回复通知：", parentComment.mail);
    return undefined;
  }
  let sendResult: unknown;
  try {
    sendResult = await transporter?.sendMail({
      from: `"${config.SENDER_NAME}" <${config.SENDER_EMAIL}>`,
      to: parentComment.mail,
      subject: emailSubject,
      html: emailContent,
    });
  } catch (e) {
    sendResult = e;
  }
  logger.verbose("回复通知结果：", sendResult);
  return sendResult;
}

/**
 * 发送通知（1.x sendNotice 对齐：垃圾评论豁免 + 三路并发，失败不阻断）。
 * @param options 通知入参
 */
export async function sendNotice(options: {
  comment: CommentDoc;
  config: ConfigData;
  caps: Capabilities;
  logger: RequestLogger;
  getParentComment: (comment: CommentDoc) => Promise<CommentDoc | null>;
}): Promise<void> {
  const { comment, config, caps, logger, getParentComment } = options;
  if (comment.isSpam && config.NOTIFY_SPAM === "false") return;
  await Promise.all([
    noticeMaster({ comment, config, caps, logger }),
    noticeReply({ currentComment: comment, config, caps, logger, getParentComment }),
    noticePushoo({ comment, config, logger }),
  ]).catch((err) => {
    logger.error("通知异常：", err);
  });
}

/**
 * 邮件测试（1.x emailTest 对齐：重置传输器 → 校验配置 → 发送测试邮件）。
 * @param options 测试入参
 * @returns 测试响应
 */
export async function emailTest(options: {
  mail?: string;
  config: ConfigData;
  isAdminUser: boolean;
  caps: Capabilities;
  logger: RequestLogger;
}): Promise<Record<string, unknown>> {
  const { mail, config, isAdminUser, caps, logger } = options;
  void caps;
  /** 响应体 */
  const res: Record<string, unknown> = {};
  if (!isAdminUser) {
    res.code = RES_CODE.NEED_LOGIN;
    res.message = "请先登录";
    return res;
  }
  try {
    // 邮件测试前清除 transporter，保证读取的是最新的配置
    transporter = null;
    await initMailer({ config, throwErr: true, caps, logger });
    const toMail = mail || config.BLOGGER_EMAIL || config.SENDER_EMAIL;
    if (!isValidEmail(toMail)) {
      res.message = "邮箱格式不合法";
      return res;
    }
    const t = transporter as ReturnType<NodemailerLike["createTransport"]> | null;
    const sendResult = await t?.sendMail({
      from: config.SENDER_EMAIL,
      to: toMail,
      subject: "Twikoo 邮件通知测试邮件",
      html: "如果您收到这封邮件，说明 Twikoo 邮件功能配置正确",
    });
    res.result = sendResult;
  } catch (e) {
    res.message = e instanceof Error ? e.message : String(e);
  }
  return res;
}

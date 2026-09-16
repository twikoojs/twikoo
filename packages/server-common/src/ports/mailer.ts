/**
 * 邮件端口（规范 §6.2 ports/mailer.ts「邮件发送」）。
 *
 * 重依赖 nodemailer 由声明 mail 能力的适配器自行安装，公共库仅以 await import()
 * 动态加载（D-2 依赖外部化），本端口是对「发送一封邮件」能力的最小抽象。
 */

/** 邮件载荷（对齐 1.x transporter.sendMail 常用字段） */
export interface MailPayload {
  /** 发件人（「名称 <地址>」格式，来自 SENDER_NAME / SENDER_EMAIL 配置） */
  from: string;
  /** 收件人地址 */
  to: string;
  /** 邮件主题 */
  subject: string;
  /** HTML 正文（模板渲染结果） */
  html: string;
  /** 纯文本正文（可选；受限通道可能仅支持其中一种形态） */
  text?: string;
}

/**
 * 邮件发送端口。
 * 发送失败以异常上抛，由业务层捕获并转为用户友好错误；未声明 mail 能力
 * （capabilities.mail 非 true）时公共库不得调用本端口。
 */
export interface Mailer {
  /** 发送一封邮件 */
  send(payload: MailPayload): Promise<void>;
}

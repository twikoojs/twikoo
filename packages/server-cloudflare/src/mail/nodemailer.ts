/**
 * HTTP 版 nodemailer 垫片（经 `setCustomLibs` 注入）。
 *
 * Workers 出不了裸 TCP，`nodemailer` 的 SMTP 通道用不了，故 `createTransport()` 返回的
 * 对象不发 SMTP，而是按 `SMTP_SERVICE` 打各家的 HTTP API（1.x twikoo-cloudflare 的做法，
 * 2.0 原样移植并补上 Resend）：
 *
 * | 配置 | 通路 |
 * | --- | --- |
 * | `SMTP_SERVICE=SendGrid` | `POST https://api.sendgrid.com/v3/mail/send` |
 * | `SMTP_SERVICE=MailChannels` | `POST https://api.mailchannels.net/tx/v1/send` |
 * | `SMTP_SERVICE=Resend` | `POST https://api.resend.com/emails` |
 * | 其余 | 抛可读错误，提示受支持的通道 |
 *
 * 注入后 `lib-loader` 的 `getNodemailer` **覆写优先于能力门**，因此 `mail: "restricted"`
 * 名副其实：能力存在，但只有受限通道可用（与 eo-makers 同款声明方式）。
 *
 * **与 1.x 的一处刻意差异**：响应会检查 `response.ok`，非 2xx 抛出带状态码的错误。
 * 1.x 直接 `return fetch(...)` 不看响应，API Key 失效这类失败会被当成发送成功。
 */
import type { NodemailerLike } from "@twikoojs/common";

/** 不受支持的邮件配置抛出的文案 */
const UNSUPPORTED_MESSAGE =
  "Cloudflare 部署仅支持 SendGrid、MailChannels、Resend 邮件服务（Workers 无法建立 SMTP 连接）。";

/** 垫片收到的邮件载荷形态（notify 传入的字段） */
interface MailPayload {
  /** 发件人（含显示名） */
  from?: string;
  /** 收件人 */
  to?: string;
  /** 标题 */
  subject?: string;
  /** HTML 正文 */
  html?: string;
}

/** 传输器配置形态（Twikoo 的 SMTP_* 配置 + 服务名） */
interface TransportConfig {
  /** 服务名（`SMTP_SERVICE`） */
  service?: string;
  /** SMTP 主机（Workers 不支持，仅用于识别出「配了 SMTP 但用不了」并给出可读错误） */
  host?: string;
  /** 认证信息（`SMTP_USER` / `SMTP_PASS`） */
  auth?: {
    /** 账户名（HTTP 通道不校验，但 Twikoo 要求非空） */
    user?: string;
    /** 密码 / API 令牌 */
    pass?: string;
  };
}

/**
 * 取小写的服务名。
 * @param mailConfig 传输器配置
 * @returns 服务名（小写）
 */
function getMailService(mailConfig: TransportConfig): string {
  return String(mailConfig.service ?? "").toLowerCase();
}

/**
 * 校验认证信息（1.x twikoo-cloudflare 文案逐字对齐）。
 * @param mailConfig 传输器配置
 */
function validateMailAuth(mailConfig: TransportConfig): void {
  if (!mailConfig.auth?.user) {
    throw new Error("需要在 SMTP_USER 中配置账户名，如果邮件服务不需要可随意填写。");
  }
  if (!mailConfig.auth?.pass) {
    throw new Error("需要在 SMTP_PASS 中配置 API 令牌。");
  }
}

/**
 * 走 HTTP API 发信（SendGrid / MailChannels / Resend）。
 * @param service 服务名（小写）
 * @param mailConfig 传输器配置（令牌取 `auth.pass`）
 * @param mail 邮件内容
 * @returns 发送结果
 */
async function sendViaHttpApi(
  service: string,
  mailConfig: TransportConfig,
  mail: MailPayload,
): Promise<unknown> {
  const token = String(mailConfig.auth?.pass ?? "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let endpoint: string;
  let body: string;
  /** 错误文案里的服务显示名 */
  let displayName: string;
  if (service === "sendgrid") {
    displayName = "SendGrid";
    endpoint = "https://api.sendgrid.com/v3/mail/send";
    headers.Authorization = `Bearer ${token}`;
    body = JSON.stringify({
      personalizations: [{ to: [{ email: mail.to }] }],
      from: { email: mail.from },
      subject: mail.subject,
      content: [{ type: "text/html", value: mail.html }],
    });
  } else if (service === "mailchannels") {
    displayName = "MailChannels";
    endpoint = "https://api.mailchannels.net/tx/v1/send";
    headers["X-Api-Key"] = token;
    headers.Accept = "application/json";
    body = JSON.stringify({
      personalizations: [{ to: [{ email: mail.to }] }],
      from: { email: mail.from },
      subject: mail.subject,
      content: [{ type: "text/html", value: mail.html }],
    });
  } else {
    displayName = "Resend";
    endpoint = "https://api.resend.com/emails";
    headers.Authorization = `Bearer ${token}`;
    headers.Accept = "application/json";
    body = JSON.stringify({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
  }
  const response = await fetch(endpoint, { method: "POST", headers, body });
  if (!response.ok) {
    throw new Error(`${displayName} 发送失败：HTTP ${response.status} ${await response.text()}`);
  }
  return { ok: true, status: response.status };
}

/**
 * 校验配置可发信（认证字段 + 受支持的通道），不通过即抛错。
 * @param mailConfig 传输器配置
 */
function assertSendable(mailConfig: TransportConfig): void {
  validateMailAuth(mailConfig);
  const service = getMailService(mailConfig);
  if (service !== "sendgrid" && service !== "mailchannels" && service !== "resend") {
    throw new Error(UNSUPPORTED_MESSAGE);
  }
}

/**
 * 构造 nodemailer 垫片。
 * @returns 可注入 `setCustomLibs` 的 nodemailer 形态对象
 */
export function createCloudflareNodemailer(): NodemailerLike {
  return {
    /**
     * 创建传输器（不发 SMTP，只是把配置闭包进方法）
     * @param options 传输器配置
     * @returns 传输器
     */
    createTransport(options: unknown): ReturnType<NodemailerLike["createTransport"]> {
      const mailConfig = (options ?? {}) as TransportConfig;
      return {
        /**
         * 校验配置是否可用（1.x 语义：只做配置形态校验，不发探测请求）
         * @returns 恒为 true
         */
        verify(): Promise<boolean> {
          // 包一层 promise：校验失败要是「拒绝的 promise」而不是同步抛（与 sendMail 的错误契约一致）
          return Promise.resolve().then(() => {
            assertSendable(mailConfig);
            return true;
          });
        },
        /**
         * 发信
         * @param mail 邮件载荷
         * @returns 发送结果
         */
        async sendMail(mail: unknown): Promise<unknown> {
          const payload = (mail ?? {}) as MailPayload;
          assertSendable(mailConfig);
          return sendViaHttpApi(getMailService(mailConfig), mailConfig, payload);
        },
      };
    },
  };
}

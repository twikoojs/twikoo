/**
 * Cloudflare 邮件适配器（经 `setCustomLibs` 注入）。
 *
 * 显式 SendGrid / MailChannels / Resend 服务保留 HTTP API；其他配置通过
 * nodejs_compat 使用真实 nodemailer。共享通知层可缓存此配置包装器，但每次
 * verify / sendMail 都单独创建并关闭非池化 SMTP 传输器，不跨请求保留连接。
 * SMTP 依赖按需加载，HTTP 通道不加载只在 nodejs_compat 下可用的 Node 网络模块。
 *
 * **注意：真实边缘上直连 SMTP 走不通**，这里保留 SMTP 分支只为本地 workerd 与
 * HTTP 通道复用同一形态。workerd 对 nodemailer 的 `net` / `tls` 出站路径支持不全，
 * 在 Cloudflare Workers 上 25 / 587 / 465 三个端口分别报
 * `Connections to port 25 are prohibited`、`TLS Handshake Failed.`、
 * `Connection closed`（或 `proxy request failed, cannot connect to the specified address`），
 * 且都与账号密码无关 —— 也就是连会话都建不起来。面向用户的说明见包 README 的
 * 「邮件通知」（只讲现状，不讲原因）。
 */
import type { NodemailerLike } from "@twikoojs/common";

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
  /** SMTP 主机 */
  host?: string;
  /** SMTP 端口 */
  port?: number;
  /** 是否直接建立 TLS 连接 */
  secure?: boolean;
  /** 认证信息（`SMTP_USER` / `SMTP_PASS`） */
  auth?: {
    /** 账户名（HTTP 通道不校验，但 Twikoo 要求非空） */
    user?: string;
    /** 密码 / API 令牌 */
    pass?: string;
  };
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
  /** 错误文案里的服务显示名 */
  let displayName: string;
  if (service === "sendgrid") {
    displayName = "SendGrid";
    endpoint = "https://api.sendgrid.com/v3/mail/send";
    headers.Authorization = `Bearer ${token}`;
  } else if (service === "mailchannels") {
    displayName = "MailChannels";
    endpoint = "https://api.mailchannels.net/tx/v1/send";
    headers["X-Api-Key"] = token;
    headers.Accept = "application/json";
  } else {
    displayName = "Resend";
    endpoint = "https://api.resend.com/emails";
    headers.Authorization = `Bearer ${token}`;
    headers.Accept = "application/json";
  }
  const body = JSON.stringify(
    service === "sendgrid" || service === "mailchannels"
      ? {
          personalizations: [{ to: [{ email: mail.to }] }],
          from: { email: mail.from },
          subject: mail.subject,
          content: [{ type: "text/html", value: mail.html }],
        }
      : {
          from: mail.from,
          to: mail.to,
          subject: mail.subject,
          html: mail.html,
        },
  );
  const response = await fetch(endpoint, { method: "POST", headers, body });
  if (!response.ok) {
    throw new Error(`${displayName} 发送失败：HTTP ${response.status} ${await response.text()}`);
  }
  return { ok: true, status: response.status };
}

/**
 * 构造兼容 HTTP 通道的 nodemailer 适配器。
 * @returns 可注入 `setCustomLibs` 的 nodemailer 形态对象
 */
export function createCloudflareNodemailer(): NodemailerLike {
  return {
    /**
     * 创建仅保存配置的包装器，实际连接在发送或校验时建立。
     * @param options 传输器配置
     * @returns 传输器
     */
    createTransport(options: unknown): ReturnType<NodemailerLike["createTransport"]> {
      const mailConfig = (options ?? {}) as TransportConfig;
      const service = String(mailConfig.service ?? "").toLowerCase();
      const httpApi = service === "sendgrid" || service === "mailchannels" || service === "resend";
      return {
        /**
         * HTTP 通道只校验配置；SMTP 通道执行真实的连接及认证校验。
         * @returns 配置是否可用
         */
        async verify(): Promise<boolean> {
          if (httpApi) {
            validateMailAuth(mailConfig);
            return true;
          }
          const { default: nodemailer } = await import("nodemailer");
          const transport = nodemailer.createTransport({ ...mailConfig, pool: false });
          try {
            return await transport.verify();
          } finally {
            transport.close();
          }
        },
        /**
         * 发信
         * @param mail 邮件载荷
         * @returns 发送结果
         */
        async sendMail(mail: unknown): Promise<unknown> {
          if (httpApi) {
            validateMailAuth(mailConfig);
            return sendViaHttpApi(service, mailConfig, mail ?? {});
          }
          const { default: nodemailer } = await import("nodemailer");
          const transport = nodemailer.createTransport({ ...mailConfig, pool: false });
          try {
            return await transport.sendMail(mail as Parameters<typeof transport.sendMail>[0]);
          } finally {
            transport.close();
          }
        },
      };
    },
  };
}

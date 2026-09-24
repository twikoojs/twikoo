/**
 * EO Makers 的 HTTP 版 nodemailer 垫片（经 `setCustomLibs` 注入）。
 *
 * 移植自 1.x `src/server/eo-makers/cloud-functions/index.js` 的
 * `setCustomLibs({ nodemailer })` 段（L290-345）。EO 不能裸 TCP，所以
 * `createTransport()` 返回的对象不发 SMTP，而是：
 *
 * | 配置 | 通路 |
 * | --- | --- |
 * | `SMTP_SERVICE=SendGrid` | `POST https://api.sendgrid.com/v3/mail/send` |
 * | `SMTP_SERVICE=MailChannels` | `POST https://api.mailchannels.net/tx/v1/send` |
 * | 配置了 `SMTP_HOST` | 经**同项目**的 Go SMTP Bridge 转发（见 `./smtp-bridge`） |
 * | 其余 | 抛可读错误，提示受支持的通道 |
 *
 * 注意上表第三行：桥接是部署包里 `cloud-functions/smtp.go` 编译出的 `/smtp` 路由，
 * **不需要另外部署一个服务**（1.x 的文档把它写成「自行部署 SMTP 通道」，容易误读）。
 *
 * 注入后 `lib-loader` 的 `getNodemailer` **覆写优先于能力门**，因此
 * `mail: "restricted"` 名副其实：能力存在，但只有受限通道可用。
 *
 * **与 1.x 的一处刻意差异**：SendGrid / MailChannels 的响应会检查 `response.ok`，
 * 非 2xx 抛错（带 HTTP 状态）。1.x 直接 `return fetch(...)` 不检查响应，API Key 失效
 * 这类失败会被算作发送成功，只在日志里留下一个 Response 对象。
 */
import type { NodemailerLike } from "@twikoojs/common";
import { type BridgeMailConfig, requestSmtpBridge } from "./smtp-bridge";

/** 不受支持的邮件配置抛出的文案（1.x 逐字对齐） */
const UNSUPPORTED_MESSAGE =
  "EdgeOne Makers 仅支持 SendGrid、MailChannels，或通过 SMTP_HOST 使用 Go SMTP Bridge。";

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

/** 传输器配置形态（SMTP 配置 + 服务名） */
type TransportConfig = BridgeMailConfig & { service?: string };

/**
 * 取小写的服务名。
 * @param mailConfig 传输器配置
 * @returns 服务名
 */
function getMailService(mailConfig: TransportConfig): string {
  return String(mailConfig.service ?? "").toLowerCase();
}

/**
 * 校验认证信息（1.x validateMailAuth 对齐）。
 * @param mailConfig 传输器配置
 */
function validateMailAuth(mailConfig: TransportConfig): void {
  if (!mailConfig.auth?.user) {
    throw new Error("需要在 SMTP_USER 中配置账户名，如果邮件服务不需要可随意填写。");
  }
  if (!mailConfig.auth?.pass) {
    throw new Error("需要在 SMTP_PASS 中配置密码或 API 令牌。");
  }
}

/**
 * 走 HTTP API 发信（SendGrid / MailChannels）。
 * @param service 服务名
 * @param mailConfig 传输器配置（API 令牌取 auth.pass）
 * @param mail 邮件内容
 * @returns 发送结果
 */
async function sendViaHttpApi(
  service: string,
  mailConfig: TransportConfig,
  mail: MailPayload,
): Promise<unknown> {
  const isSendGrid = service === "sendgrid";
  /** 展示名（错误文案用配置里的写法，而非内部小写形态） */
  const displayName = isSendGrid ? "SendGrid" : "MailChannels";
  const endpoint = isSendGrid
    ? "https://api.sendgrid.com/v3/mail/send"
    : "https://api.mailchannels.net/tx/v1/send";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isSendGrid) {
    headers.Authorization = `Bearer ${mailConfig.auth?.pass}`;
  } else {
    headers["X-Api-Key"] = String(mailConfig.auth?.pass ?? "");
    headers.Accept = "application/json";
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      personalizations: [{ to: [{ email: mail.to }] }],
      from: { email: mail.from },
      subject: mail.subject,
      content: [{ type: "text/html", value: mail.html }],
    }),
  });
  if (!response.ok) {
    throw new Error(`${displayName} 发送失败：HTTP ${response.status} ${await response.text()}`);
  }
  return { ok: true, status: response.status };
}

/**
 * 构造 nodemailer 垫片。
 * @returns 可注入 `setCustomLibs` 的 nodemailer 形态对象
 */
export function createEoNodemailer(): NodemailerLike {
  return {
    /**
     * 创建传输器（不发 SMTP，只是把配置闭包进方法）。
     * @param options 传输器配置
     * @returns 传输器
     */
    createTransport(options: unknown) {
      const mailConfig = (options ?? {}) as TransportConfig;
      return {
        /**
         * 校验配置是否可用（1.x verify 对齐）。
         * @returns 是否可用
         */
        async verify(): Promise<unknown> {
          validateMailAuth(mailConfig);
          const service = getMailService(mailConfig);
          if (service === "sendgrid" || service === "mailchannels") {
            // SendGrid / MailChannels 只认 Bearer / X-Api-Key，不需要 SMTP 主机
            return true;
          }
          if (mailConfig.host) {
            await requestSmtpBridge("verify", mailConfig);
            return true;
          }
          throw new Error(UNSUPPORTED_MESSAGE);
        },
        /**
         * 发信。
         * @param mail 邮件载荷
         * @returns 发送结果
         */
        async sendMail(mail: unknown): Promise<unknown> {
          const payload = (mail ?? {}) as MailPayload;
          validateMailAuth(mailConfig);
          const service = getMailService(mailConfig);
          if (mailConfig.host) {
            return requestSmtpBridge("send", mailConfig, {
              from: payload.from,
              to: payload.to,
              subject: payload.subject,
              html: payload.html,
            });
          }
          if (service === "sendgrid" || service === "mailchannels") {
            return sendViaHttpApi(service, mailConfig, payload);
          }
          throw new Error(UNSUPPORTED_MESSAGE);
        },
      };
    },
  };
}

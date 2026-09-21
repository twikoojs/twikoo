/** EO Makers 邮件通路（HTTP 版 nodemailer 垫片 + Go SMTP Bridge 客户端）。 */
export { createEoNodemailer } from "./nodemailer";
export {
  type BridgeMailConfig,
  type MailBridgeContext,
  createMailBridgeContext,
  requestSmtpBridge,
  withMailBridgeContext,
} from "./smtp-bridge";

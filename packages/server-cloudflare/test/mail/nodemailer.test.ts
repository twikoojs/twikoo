/**
 * 邮件垫片测试（SendGrid / MailChannels / Resend 三条 HTTP 通道 + 失败与配置校验）。
 */
import { describe, expect, it } from "vitest";
import { getNodemailer, resetCustomLibs } from "@twikoojs/common";
import { createCloudflareNodemailer } from "../../src/mail/nodemailer";
import { cloudflareCapabilities } from "../../src/main";
import { fetchCalls, useFakeFetch } from "../utils/fake-fetch";

/** 构造传输器 */
function transporter(service: string) {
  return createCloudflareNodemailer().createTransport({
    service,
    auth: { user: "user", pass: "token" },
  });
}

/** 一封邮件 */
const mail = { from: "blog@example.com", to: "guest@example.com", subject: "回复", html: "<p>hi</p>" };

describe("HTTP 版 nodemailer 垫片", () => {
  it("SendGrid：POST /v3/mail/send + Bearer 令牌 + personalizations 载荷", async () => {
    useFakeFetch(() => ({ status: 202, text: "" }));
    await transporter("SendGrid").sendMail(mail);
    const call = fetchCalls()[0];
    expect(call.url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(call.headers.Authorization).toBe("Bearer token");
    expect(call.body).toMatchObject({
      personalizations: [{ to: [{ email: "guest@example.com" }] }],
      from: { email: "blog@example.com" },
      subject: "回复",
      content: [{ type: "text/html", value: "<p>hi</p>" }],
    });
  });

  it("MailChannels：POST /tx/v1/send + X-Api-Key", async () => {
    useFakeFetch(() => ({ status: 202, text: "" }));
    await transporter("MailChannels").sendMail(mail);
    const call = fetchCalls()[0];
    expect(call.url).toBe("https://api.mailchannels.net/tx/v1/send");
    expect(call.headers["X-Api-Key"]).toBe("token");
    expect(call.body.personalizations).toEqual([{ to: [{ email: "guest@example.com" }] }]);
  });

  it("Resend（1.x 也支持的第 3 条通道）：POST /emails + 扁平载荷", async () => {
    useFakeFetch(() => ({ status: 200, json: { id: "x" } }));
    await transporter("Resend").sendMail(mail);
    const call = fetchCalls()[0];
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.headers.Authorization).toBe("Bearer token");
    expect(call.body).toMatchObject({ from: "blog@example.com", to: "guest@example.com" });
  });

  it("非 2xx 抛错并带上状态码（1.x 不看响应的坑在此修掉）", async () => {
    useFakeFetch(() => ({ status: 401, text: "invalid api key" }));
    await expect(transporter("SendGrid").sendMail(mail)).rejects.toThrow(
      "SendGrid 发送失败：HTTP 401 invalid api key",
    );
  });

  it("不支持的服务名（含 SMTP 直连配置）抛可读文案；verify 同样受约束", async () => {
    await expect(transporter("QQ").sendMail(mail)).rejects.toThrow("仅支持 SendGrid、MailChannels、Resend");
    await expect(transporter("").verify?.()).rejects.toThrow("仅支持 SendGrid、MailChannels、Resend");
    // 只配了 SMTP_HOST（1.x 也支持该分支，Workers 上不可用）同样落到该文案
    const smtpOnly = createCloudflareNodemailer().createTransport({
      host: "smtp.example.com",
      auth: { user: "u", pass: "p" },
    });
    await expect(smtpOnly.verify?.()).rejects.toThrow("Workers 无法建立 SMTP 连接");
  });

  it("认证信息缺失的文案与 1.x 逐字一致", async () => {
    const noUser = createCloudflareNodemailer().createTransport({
      service: "SendGrid",
      auth: { pass: "t" },
    });
    await expect(noUser.verify?.()).rejects.toThrow("需要在 SMTP_USER 中配置账户名");
    const noPass = createCloudflareNodemailer().createTransport({
      service: "SendGrid",
      auth: { user: "u" },
    });
    await expect(noPass.verify?.()).rejects.toThrow("需要在 SMTP_PASS 中配置 API 令牌");
  });

  it("supported 通道的 verify 返回 true（不发探测请求）", async () => {
    await expect(transporter("SendGrid").verify?.()).resolves.toBe(true);
    await expect(transporter("Resend").verify?.()).resolves.toBe(true);
  });
});

describe("能力门与覆写的配合", () => {
  it("mail: restricted 靠覆写成立：注入垫片后 getNodemailer 可用", async () => {
    // 能力门只认 `=== true`，"restricted" 会被判为不支持；覆写优先于能力门
    resetCustomLibs();
    expect(cloudflareCapabilities.mail).toBe("restricted");
    await expect(getNodemailer(cloudflareCapabilities)).rejects.toThrow("未声明 mail 能力");
    const { installCloudflareLibs } = await import("../../src/main");
    installCloudflareLibs();
    const nodemailer = await getNodemailer(cloudflareCapabilities);
    expect(typeof nodemailer.createTransport).toBe("function");
    resetCustomLibs();
  });
});

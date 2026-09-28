/**
 * HTTP 邮件通道测试（SendGrid / MailChannels / Resend + 失败与配置校验）。
 */
import { describe, expect, it } from "vitest";
import { createCloudflareNodemailer } from "../../src/mail/nodemailer";
import { fetchCalls, useFakeFetch } from "../utils/fake-fetch";

/** 构造传输器 */
function transporter(service: string) {
  return createCloudflareNodemailer().createTransport({
    service,
    host: "smtp.invalid",
    auth: { user: "user", pass: "token" },
  });
}

/** 一封邮件 */
const mail = {
  from: "blog@example.com",
  to: "guest@example.com",
  subject: "回复",
  html: "<p>hi</p>",
};

describe("显式 HTTP 邮件通道", () => {
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
    expect(call.headers.Accept).toBe("application/json");
    expect(call.body).toEqual({
      personalizations: [{ to: [{ email: "guest@example.com" }] }],
      from: { email: "blog@example.com" },
      subject: "回复",
      content: [{ type: "text/html", value: "<p>hi</p>" }],
    });
  });

  it("Resend（1.x 也支持的第 3 条通道）：POST /emails + 扁平载荷", async () => {
    useFakeFetch(() => ({ status: 200, json: { id: "x" } }));
    await transporter("Resend").sendMail(mail);
    const call = fetchCalls()[0];
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.headers.Authorization).toBe("Bearer token");
    expect(call.headers.Accept).toBe("application/json");
    expect(call.body).toEqual({
      from: "blog@example.com",
      to: "guest@example.com",
      subject: "回复",
      html: "<p>hi</p>",
    });
  });

  it("非 2xx 抛错并带上状态码（1.x 不看响应的坑在此修掉）", async () => {
    useFakeFetch(() => ({ status: 401, text: "invalid api key" }));
    await expect(transporter("SendGrid").sendMail(mail)).rejects.toThrow(
      "SendGrid 发送失败：HTTP 401 invalid api key",
    );
  });

  it("HTTP 通道拒绝缺失的认证字段，且不发出请求", async () => {
    useFakeFetch(() => ({ status: 200 }));
    const noUser = createCloudflareNodemailer().createTransport({
      service: "SendGrid",
      auth: { pass: "t" },
    });
    await expect(noUser.verify?.()).rejects.toThrow();
    await expect(noUser.sendMail(mail)).rejects.toThrow();
    const noPass = createCloudflareNodemailer().createTransport({
      service: "SendGrid",
      auth: { user: "u" },
    });
    await expect(noPass.verify?.()).rejects.toThrow();
    await expect(noPass.sendMail(mail)).rejects.toThrow();
    expect(fetchCalls()).toEqual([]);
  });

  it("supported 通道的 verify 返回 true（不发探测请求）", async () => {
    useFakeFetch(() => ({ status: 200 }));
    await expect(transporter("SendGrid").verify?.()).resolves.toBe(true);
    await expect(transporter("Resend").verify?.()).resolves.toBe(true);
    expect(fetchCalls()).toEqual([]);
  });
});

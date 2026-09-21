/**
 * EO Makers 邮件：SendGrid / MailChannels 通道与参数校验。
 *
 * fetch 由替身接管，断言请求地址、认证头与载荷形态；非 2xx 的行为是本实现对
 * 1.x 的一处刻意加强（1.x 直接 `return fetch(...)`，不检查响应）。
 */
import { describe, expect, it } from "vitest";
import { createEoNodemailer } from "../src/mail/nodemailer";
import { fetchCalls, useFakeFetch } from "./utils/fake-fetch";

/** 一封测试邮件 */
const MAIL = {
  from: `"站点" <no-reply@example.com>`,
  to: "admin@example.com",
  subject: "新评论通知",
  html: "<p>内容</p>",
};

/**
 * 构造传输器。
 * @param config 传输器配置
 * @returns 传输器
 */
function makeTransporter(config: Record<string, unknown>) {
  return createEoNodemailer().createTransport(config);
}

describe("EO Makers 邮件：HTTP 服务通道", () => {
  it("SendGrid：Bearer 取 SMTP_PASS，正文走 HTML content", async () => {
    useFakeFetch(() => ({ status: 202, json: {} }));
    const result = await makeTransporter({
      service: "SendGrid",
      auth: { user: "apikey", pass: "SG.key" },
    }).sendMail(MAIL);

    expect(result).toEqual({ ok: true, status: 202 });
    const calls = fetchCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(calls[0].headers.Authorization).toBe("Bearer SG.key");
    expect(calls[0].body.personalizations).toEqual([{ to: [{ email: MAIL.to }] }]);
    expect((calls[0].body.content as Array<{ type: string; value: string }>)[0]).toEqual({
      type: "text/html",
      value: MAIL.html,
    });
  });

  it("MailChannels：X-Api-Key 取 SMTP_PASS", async () => {
    useFakeFetch(() => ({ status: 200, json: {} }));
    await makeTransporter({
      service: "mailchannels",
      auth: { user: "user", pass: "MC.key" },
    }).sendMail(MAIL);

    const calls = fetchCalls();
    expect(calls[0].url).toBe("https://api.mailchannels.net/tx/v1/send");
    expect(calls[0].headers["X-Api-Key"]).toBe("MC.key");
  });

  it("非 2xx 抛错（1.x 不检查响应，这里改为显式失败）", async () => {
    useFakeFetch(() => ({ status: 401, json: { errors: [] } }));
    await expect(
      makeTransporter({ service: "SendGrid", auth: { user: "u", pass: "bad" } }).sendMail(MAIL),
    ).rejects.toThrow(/SendGrid 发送失败：HTTP 401/);
  });

  it("verify：HTTP 服务不需要 SMTP 主机即视为可用，且不发请求", async () => {
    useFakeFetch(() => ({ status: 200, json: { ok: true } }));
    await expect(
      makeTransporter({ service: "SendGrid", auth: { user: "u", pass: "p" } }).verify?.(),
    ).resolves.toBe(true);
    expect(fetchCalls()).toHaveLength(0);
  });
});

describe("EO Makers 邮件：参数校验与不受支持的配置", () => {
  it("既无 SMTP_HOST 也不是 HTTP 服务 → 抛出受支持通道提示", async () => {
    useFakeFetch(() => ({ status: 200, json: { ok: true } }));
    const transporter = makeTransporter({ service: "QQ", auth: { user: "u", pass: "p" } });
    const expected =
      "EdgeOne Makers 仅支持 SendGrid、MailChannels，或通过 SMTP_HOST 使用 Go SMTP Bridge。";
    await expect(transporter.sendMail(MAIL)).rejects.toThrow(expected);
    await expect(transporter.verify?.()).rejects.toThrow(expected);
  });

  it("缺 SMTP_USER / SMTP_PASS → 分别给出对应提示", async () => {
    useFakeFetch(() => ({ status: 200, json: { ok: true } }));
    await expect(
      makeTransporter({ service: "SendGrid", auth: { pass: "p" } }).sendMail(MAIL),
    ).rejects.toThrow(/SMTP_USER/);
    await expect(
      makeTransporter({ service: "SendGrid", auth: { user: "u" } }).sendMail(MAIL),
    ).rejects.toThrow(/SMTP_PASS/);
  });
});

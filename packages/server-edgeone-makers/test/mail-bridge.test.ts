/**
 * EO Makers 邮件：Go SMTP Bridge 通道与上下文构造。
 *
 * **签名由测试侧独立重算**（不是让实现自证）：替身按 1.x 的算法给 probe 应答，
 * 一旦适配器不校验签名或算错，用例即红。
 */
import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { TkRequest } from "@twikoojs/common";
import { createEoNodemailer } from "../src/mail/nodemailer";
import {
  type MailBridgeContext,
  createMailBridgeContext,
  withMailBridgeContext,
} from "../src/mail/smtp-bridge";
import { type FetchCall, fetchCalls, useFakeFetch } from "./utils/fake-fetch";

/** Bridge 共享密钥（测试用固定值） */
const TOKEN = "bridge-token";

/** 一封测试邮件 */
const MAIL = {
  from: `"站点" <no-reply@example.com>`,
  to: "admin@example.com",
  subject: "新评论通知",
  html: "<p>内容</p>",
};

/**
 * 按 1.x 的算法重算 probe 签名。
 * @param nonce 挑战随机数
 * @param host Bridge host
 * @returns 十六进制签名
 */
function signProbe(nonce: string, host: string): string {
  return createHmac("sha256", TOKEN).update(nonce).update("\n").update(host).digest("hex");
}

/** 应答 probe（签名正确）+ 其余动作 */
function bridgeResponder(call: FetchCall): { status: number; json: unknown } {
  if (call.body.action === "probe") {
    return {
      status: 200,
      json: {
        ok: true,
        bridgeHost: call.body.bridgeHost,
        signature: signProbe(String(call.body.nonce), String(call.body.bridgeHost)),
      },
    };
  }
  return { status: 200, json: { ok: true, messageId: "bridge-1" } };
}

/**
 * 构造传输器。
 * @param config 传输器配置
 * @returns 传输器
 */
function makeTransporter(config: Record<string, unknown>) {
  return createEoNodemailer().createTransport(config);
}

/** SMTP_HOST 形态的传输器配置 */
const SMTP_CONFIG = {
  host: "smtp.example.com",
  port: 465,
  secure: true,
  auth: { user: "u", pass: "p" },
};

describe("EO Makers 邮件：Go SMTP Bridge 通道", () => {
  it("send：先 probe 校验签名，再发 action=send（携带 SMTP 配置与邮件）", async () => {
    useFakeFetch(bridgeResponder);
    const context: MailBridgeContext = { urls: ["https://bridge.example.com/smtp"], token: TOKEN };
    const result = await withMailBridgeContext(context, async () =>
      makeTransporter(SMTP_CONFIG).sendMail(MAIL),
    );

    expect(result).toEqual({ ok: true, messageId: "bridge-1" });
    const calls = fetchCalls();
    expect(calls.map((call) => call.body.action)).toEqual(["probe", "send"]);
    const send = calls[1];
    expect(send.url).toBe("https://bridge.example.com/smtp");
    expect(send.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(send.body.host).toBe("smtp.example.com");
    expect(send.body.port).toBe(465);
    expect(send.body.to).toBe(MAIL.to);
    expect(send.body.html).toBe(MAIL.html);
    // 探测通过后回填，同一上下文内不再重复探测
    expect(context.url).toBe("https://bridge.example.com/smtp");
  });

  it("verify：走 action=verify", async () => {
    useFakeFetch(bridgeResponder);
    await withMailBridgeContext({ urls: ["https://bridge.example.com/smtp"], token: TOKEN }, () =>
      makeTransporter(SMTP_CONFIG).verify?.(),
    );

    expect(fetchCalls().map((call) => call.body.action)).toEqual(["probe", "verify"]);
  });

  it("probe 签名不符 → 自动发现失败并列出候选地址", async () => {
    useFakeFetch((call) => ({
      status: 200,
      json: { ok: true, bridgeHost: call.body.bridgeHost, signature: "deadbeef" },
    }));
    await expect(
      withMailBridgeContext({ urls: ["https://bridge.example.com/smtp"], token: TOKEN }, () =>
        makeTransporter(SMTP_CONFIG).sendMail(MAIL),
      ),
    ).rejects.toThrow(/SMTP Bridge 自动发现失败/);
  });

  it("未配置 TWIKOO_SMTP_BRIDGE_TOKEN → 提示缺环境变量", async () => {
    useFakeFetch(bridgeResponder);
    await expect(
      withMailBridgeContext({ urls: ["https://bridge.example.com/smtp"], token: "" }, () =>
        makeTransporter(SMTP_CONFIG).sendMail(MAIL),
      ),
    ).rejects.toThrow(/TWIKOO_SMTP_BRIDGE_TOKEN/);
  });

  it("Bridge 返回 ok:false → 抛 Bridge 给的错误文案", async () => {
    useFakeFetch((call) =>
      call.body.action === "probe"
        ? bridgeResponder(call)
        : { status: 200, json: { ok: false, message: "SMTP 认证失败" } },
    );
    await expect(
      withMailBridgeContext({ urls: ["https://bridge.example.com/smtp"], token: TOKEN }, () =>
        makeTransporter(SMTP_CONFIG).sendMail(MAIL),
      ),
    ).rejects.toThrow("SMTP 认证失败");
  });
});

describe("Bridge 上下文构造", () => {
  it("候选取自 envId / Origin / Host，路径归一为 /smtp 且去重", () => {
    process.env.TWIKOO_SMTP_BRIDGE_TOKEN = TOKEN;
    const request = {
      headers: { origin: "https://site.example.com", host: "site.example.com" },
      body: { envId: "site.example.com" },
    } as unknown as TkRequest;
    const context = createMailBridgeContext(request);

    expect(context.token).toBe(TOKEN);
    expect(context.urls).toEqual(["https://site.example.com/smtp"]);
    delete process.env.TWIKOO_SMTP_BRIDGE_TOKEN;
  });

  it("x-forwarded-proto 决定裸域名协议；非 http(s) 的 envId 被丢弃", () => {
    delete process.env.TWIKOO_SMTP_BRIDGE_TOKEN;
    const request = {
      headers: { host: "a.example.com", "x-forwarded-proto": "http" },
      body: { envId: "javascript:alert(1)" },
    } as unknown as TkRequest;
    const context = createMailBridgeContext(request);

    expect(context.urls).toEqual(["http://a.example.com/smtp"]);
    expect(context.token).toBe("");
  });
});

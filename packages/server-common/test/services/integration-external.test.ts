/**
 * 真实外部服务集成测试（2.0 收尾补充）。
 *
 * 与分支覆盖型单测（notify-upload-captcha.test.ts / upload-spam-branches.test.ts）不同，
 * 本文件**不调用 setLibImporter 注入替身**，走 lib-loader 的默认真实动态 import，
 * 真实打到外部端点：SMTP 发信 / pushoo 推送 / 图床上传 / Akismet 与腾讯云 TMS 反垃圾。
 *
 * 门禁：仅当对应 TEST_* 环境变量齐全时才运行（describe.skipIf）；缺失则整组 skipped
 * （非 failed），CI 无 Secrets 照常绿，fork PR 也能通过。
 *
 * 本地有 .env 且填了真实凭据时，这些用例会真实发信 / 推送 / 上传 / 检测——存在真实副作用，
 * 请仅在需要时启用（变量清单见根 `.env.example`）。
 */
import { describe, expect, it } from "vitest";
import { emailTest } from "../../src/services/notify";
import { uploadImage } from "../../src/services/upload";
import { postCheckSpam } from "../../src/services/spam";
import { getPushoo } from "../../src/utils/lib-loader";
import type { Capabilities } from "../../src/ports/capabilities";
import type { ConfigData } from "../../src/ports/database";
import type { RequestLogger } from "../../src/utils/logger";

/** 环境就绪判定（与 test/setup/env.ts、packages/shared/test/utils/env.ts 同款约定） */
function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim() !== "";
}

const caps: Capabilities = {
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
};

const noopLogger: RequestLogger = {
  /** 详尽级别日志（集成测试桩：忽略） */
  verbose: () => {},
  /** 普通信息日志（集成测试桩：忽略） */
  info: () => {},
  /** 警告日志（集成测试桩：忽略） */
  warn: () => {},
  /** 错误日志（集成测试桩：忽略） */
  error: () => {},
  /** 返回已累积的日志文本（集成测试桩：空字符串） */
  getText: () => "",
  requestId: "integration",
};

/** 1x1 透明 PNG（图床上传真实样本） */
const PNG_1X1 =
  "data:image/png;base64," +
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString("base64");

// ---------------------------------------------------------------------------
// 1) 真实 SMTP 发信（emailTest：初始化 transporter + verify + 真实 sendMail）
// ---------------------------------------------------------------------------
const smtpReady =
  hasEnv("TEST_SMTP_HOST") &&
  hasEnv("TEST_SMTP_PORT") &&
  hasEnv("TEST_SMTP_USER") &&
  hasEnv("TEST_SMTP_PASS");

describe.skipIf(!smtpReady)("真实 SMTP 发信（emailTest）", () => {
  it("配置真实 SMTP 后能真实发出测试邮件", async () => {
    const config = {
      SMTP_HOST: process.env.TEST_SMTP_HOST,
      SMTP_PORT: process.env.TEST_SMTP_PORT,
      SMTP_USER: process.env.TEST_SMTP_USER,
      SMTP_PASS: process.env.TEST_SMTP_PASS,
      SMTP_SECURE: "true",
      SENDER_NAME: "Twikoo 测试",
      SENDER_EMAIL: process.env.TEST_SMTP_USER,
      BLOGGER_EMAIL: process.env.TEST_SMTP_USER,
      SITE_NAME: "Twikoo 测试站",
      SITE_URL: "https://example.com",
    } as unknown as ConfigData;
    const res = await emailTest({
      isAdminUser: true,
      config,
      caps,
      logger: noopLogger,
    });
    // 成功：{ result }；失败：{ message }
    expect((res as { message?: string }).message).toBeUndefined();
    expect((res as { result?: unknown }).result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2) 真实 pushoo 推送（20 渠道即时通知）
// ---------------------------------------------------------------------------
const pushooReady = hasEnv("TEST_PUSHOO_CHANNEL") && hasEnv("TEST_PUSHOO_TOKEN");

describe.skipIf(!pushooReady)("真实 pushoo 推送", () => {
  it("通过 pushoo 真实推送一条测试消息", async () => {
    const push = (await getPushoo()) as (
      channel: string,
      options: { token: string; content: string },
    ) => Promise<unknown>;
    const data = await push(process.env.TEST_PUSHOO_CHANNEL as string, {
      token: process.env.TEST_PUSHOO_TOKEN as string,
      content: "Twikoo 集成测试消息（可忽略）",
    });
    // 推送失败：pushoo 包内部吞错返回 { error }
    expect((data as { error?: unknown }).error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3) 真实图床上传（uploadImage：真实 axios + 图床端点）
// ---------------------------------------------------------------------------
const imageBedReady = hasEnv("TEST_IMAGE_BED_TOKEN") && hasEnv("TEST_IMAGE_BED_URL");

describe.skipIf(!imageBedReady)("真实图床上传（uploadImage）", () => {
  it("真实上传一张 1x1 PNG 并返回 https URL", async () => {
    const res = await uploadImage({
      photo: PNG_1X1,
      config: {
        IMAGE_CDN: process.env.TEST_IMAGE_BED_URL,
        IMAGE_CDN_TOKEN: process.env.TEST_IMAGE_BED_TOKEN,
      } as unknown as ConfigData,
      caps,
    });
    // 成功：res.data.url；失败：res.code
    expect((res as { code?: number }).code).toBeUndefined();
    expect((res as { data?: { url?: string } }).data?.url).toMatch(/^https?:\/\//);
  });
});

// ---------------------------------------------------------------------------
// 4) 真实反垃圾：Akismet（postCheckSpam → AkismetClient.verifyKey + checkSpam）
// ---------------------------------------------------------------------------
const akismetReady = hasEnv("TEST_AKISMET_KEY") && hasEnv("TEST_AKISMET_BLOG");

describe.skipIf(!akismetReady)("真实反垃圾 · Akismet（postCheckSpam）", () => {
  it("真实调用 Akismet 检测一条普通评论", async () => {
    const result = await postCheckSpam({
      comment: {
        _id: "integ-akismet-1",
        nick: "测试用户",
        comment: "这是一条正常的测试评论内容",
        mail: "integration-test@example.com",
        ip: "8.8.8.8",
      } as unknown as never,
      config: {
        AKISMET_KEY: process.env.TEST_AKISMET_KEY,
        SITE_URL: process.env.TEST_AKISMET_BLOG,
        BLOGGER_EMAIL: "blogger-integration@example.com",
      } as unknown as ConfigData,
      caps: { ...caps, akismet: true },
      logger: noopLogger,
    });
    // key 无效 → undefined；有效 → boolean。都不应抛错。
    expect(result === undefined || typeof result === "boolean").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5) 真实反垃圾：腾讯云 TMS（postCheckSpam → TextModeration，优先级高于 Akismet）
// ---------------------------------------------------------------------------
const tmsReady = hasEnv("TEST_TENCENT_SECRET_ID") && hasEnv("TEST_TENCENT_SECRET_KEY");

describe.skipIf(!tmsReady)("真实反垃圾 · 腾讯云 TMS（postCheckSpam）", () => {
  it("真实调用腾讯云 TMS 检测一条评论", async () => {
    const result = await postCheckSpam({
      comment: {
        _id: "integ-tms-1",
        nick: "测试用户",
        comment: "这是一条正常的内容",
        mail: "integration-test@example.com",
        ip: "8.8.8.8",
      } as unknown as never,
      config: {
        QCLOUD_SECRET_ID: process.env.TEST_TENCENT_SECRET_ID,
        QCLOUD_SECRET_KEY: process.env.TEST_TENCENT_SECRET_KEY,
        BLOGGER_EMAIL: "blogger-integration@example.com",
      } as unknown as ConfigData,
      caps: { ...caps, tencentTms: true },
      logger: noopLogger,
    });
    expect(result === undefined || typeof result === "boolean").toBe(true);
  });
});

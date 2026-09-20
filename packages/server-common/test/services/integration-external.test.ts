/**
 * 真实外部服务集成测试（2.0 收尾补充）。
 *
 * 与分支覆盖型单测（notify-upload-captcha.test.ts / upload-spam-branches.test.ts）不同，
 * 本文件**不调用 setLibImporter 注入替身**，走 lib-loader 的默认真实动态 import，
 * 真实打到外部端点：SMTP 发信 / pushoo 推送 / 图床上传 / Akismet、腾讯云 TMS 与 AI(LLM) 反垃圾。
 *
 * 门禁：仅当对应 TEST_* 环境变量齐全时才运行（describe.skipIf）；缺失则整组 skipped
 * （非 failed），CI 无 Secrets 照常绿，fork PR 也能通过。
 *
 * 本地有 .env 且填了真实凭据时，这些用例会真实发信 / 推送 / 上传 / 检测——存在真实副作用，
 * 请仅在需要时启用（变量清单见根 `.env.example`）。
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { emailTest } from "../../src/services/notify";
import { uploadImage } from "../../src/services/upload";
import { postCheckSpam } from "../../src/services/spam";
import { getPushoo } from "../../src/utils/lib-loader";
import type { Capabilities } from "../../src/ports/capabilities";
import type { ConfigData } from "../../src/ports/database";
import { createRequestLogger, type RequestLogger } from "../../src/utils/logger";

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

/**
 * PNG 分块的 CRC32 校验和（无查表实现：样本小、调用次数少，不值得建表）。
 * @param buf 参与校验的字节（分块类型 + 分块数据）
 * @returns 无符号 32 位校验和
 */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) {
      c = (c & 1) !== 0 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * 组装一个 PNG 分块（长度 + 类型 + 数据 + CRC32）。
 * @param type 四字符分块类型（IHDR / IDAT / IEND）
 * @param data 分块数据
 * @returns 完整分块字节
 */
function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * 生成一张**真实合法**的真彩 PNG（渐变内容，deflate 压不瘪体积）。
 *
 * 为什么不能用「魔数占位」的极小样本：早先的样本只有 8 字节 PNG 魔数 + 4 字节垃圾，
 * 既不是可解码的图片（兰空图床内容扫描返回 `Scan: InvalidImageContent`），
 * 尺寸又低于图床下限（1x1 触发 `Scan: ImageSizeTooSmall`）——真实图床上必然失败。
 * 32x32 渐变图实测可被图床正常接收。
 * @param size 边长（像素）
 * @returns data URL 形态的 PNG 字节
 */
function buildPng(size: number): string {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 2; // 颜色类型：真彩（RGB）
  const stride = 1 + size * 3;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0; // 行过滤器：none
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 3;
      raw[p] = (x * 7 + y * 3) & 0xff;
      raw[p + 1] = (x * 3 + y * 11) & 0xff;
      raw[p + 2] = (x ^ y) & 0xff;
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** 图床上传样本：32x32 真实 PNG（约 3 KB） */
const PNG_SAMPLE = buildPng(32);

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
const imageBedReady = hasEnv("TEST_IMAGE_CDN_TOKEN") && hasEnv("TEST_IMAGE_CDN");

describe.skipIf(!imageBedReady)("真实图床上传（uploadImage）", () => {
  it("真实上传一张 32x32 PNG 并返回 https URL", async () => {
    const res = await uploadImage({
      photo: PNG_SAMPLE,
      config: {
        IMAGE_CDN: process.env.TEST_IMAGE_CDN,
        IMAGE_CDN_TOKEN: process.env.TEST_IMAGE_CDN_TOKEN,
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
const akismetReady = hasEnv("TEST_AKISMET_KEY") && hasEnv("TEST_SITE_URL");

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
        SITE_URL: process.env.TEST_SITE_URL,
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
const tmsReady = hasEnv("TEST_QCLOUD_SECRET_ID") && hasEnv("TEST_QCLOUD_SECRET_KEY");

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
        QCLOUD_SECRET_ID: process.env.TEST_QCLOUD_SECRET_ID,
        QCLOUD_SECRET_KEY: process.env.TEST_QCLOUD_SECRET_KEY,
        BLOGGER_EMAIL: "blogger-integration@example.com",
      } as unknown as ConfigData,
      caps: { ...caps, tencentTms: true },
      logger: noopLogger,
    });
    expect(result === undefined || typeof result === "boolean").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6) 真实反垃圾：AI / LLM（postCheckSpam → checkByLLM，优先级低于腾讯云与 Akismet）
// ---------------------------------------------------------------------------
// TEST_LLM_MODEL 为可选覆盖项，不参与门禁：缺失时 checkByLLM 回退代码默认模型
const aiReady = hasEnv("TEST_LLM_API_KEY") && hasEnv("TEST_LLM_API_ENDPOINT");

describe.skipIf(!aiReady)("真实反垃圾 · AI / LLM（postCheckSpam）", () => {
  it("真实调用 OpenAI 兼容端点检测一条普通评论", async () => {
    // 真实请求日志器：checkByLLM 成功会写下「LLM 判定为 SPAM/HAM」，
    // 据此把「模型真实返回判定」与「重试耗尽后的放行兜底（返回 false）」区分开。
    const aiLogger = createRequestLogger("integration-ai");
    const result = await postCheckSpam({
      comment: {
        _id: "integ-ai-1",
        nick: "测试用户",
        comment: "这是一条正常的测试评论内容",
        mail: "integration-test@example.com",
        ip: "8.8.8.8",
      } as unknown as never,
      config: {
        LLM_API_KEY: process.env.TEST_LLM_API_KEY,
        LLM_API_ENDPOINT: process.env.TEST_LLM_API_ENDPOINT,
        // 可选覆盖：留空则由 checkByLLM 回退代码默认模型（deepseek-chat）
        LLM_MODEL: process.env.TEST_LLM_MODEL,
        BLOGGER_EMAIL: "blogger-integration@example.com",
      } as unknown as ConfigData,
      // LLM 路径经 getGenerateText 走 ai 能力门，必须声明 ai: true
      caps: { ...caps, ai: true },
      logger: aiLogger,
    });
    // 判定结果为布尔值，且日志留有模型判定记录（非重试耗尽后的放行兜底）
    expect(typeof result).toBe("boolean");
    expect(aiLogger.getText()).toContain("LLM 判定为");
  });
});

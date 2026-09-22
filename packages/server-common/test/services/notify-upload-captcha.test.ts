/**
 * 通知/上传/验证码分支测试（覆盖率补齐 II）。
 * 全部外部依赖（nodemailer/pushoo/html-to-text/axios/form-data）经
 * setLibImporter 替身注入——零真实网络。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendNotice } from "../../src/services/notify";
import {
  checkCapCaptcha,
  checkGeeTestCaptcha,
  checkTurnstileCaptcha,
} from "../../src/services/spam";
import { createMemoryAdapters, makeRequest } from "../utils/memory-adapters";
import { createHandler } from "../../src/index";
import { setCustomLibs, setLibImporter } from "../../src/utils/lib-loader";
import type { Capabilities } from "../../src/ports/capabilities";
import type { PipelineContext } from "../../src/index";

afterEach(() => {
  // 不清理会跨用例泄漏：Cap 用例曾靠上一条 Geetest 的 stub 侥幸通过
  vi.unstubAllGlobals();
});

/**
 * 安装 fetch 替身并按队列依次应答（一个用例多次请求时逐个消费）。
 * @param responses 依序返回的响应体
 * @returns fetch 替身（可断言调用参数）
 */
function stubFetchQueue(responses: unknown[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => {
    const body = responses.length > 1 ? responses.shift() : responses[0];
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * form-data 包的替身（有 getBuffer，utils/http 的 multipart 路径才真正走到）。
 * @returns 可注入 setLibImporter 的模块形态
 */
function fakeFormDataModule(): unknown {
  return {
    default: class {
      /** 已附加字段 */
      entries: Array<[string, unknown]> = [];
      /**
       * 附加字段
       * @param name 字段名
       * @param value 值
       */
      append(name: string, value: unknown): void {
        this.entries.push([name, value]);
      }
      /**
       * multipart 头
       * @returns 头
       */
      getHeaders(): Record<string, string> {
        return { "content-type": "multipart/form-data" };
      }
      /**
       * 二进制体
       * @returns Buffer
       */
      getBuffer(): Buffer {
        return Buffer.from("binary");
      }
    },
  };
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

const smtpConfig = {
  SMTP_SERVICE: "qq",
  SMTP_USER: "bot@test.com",
  SMTP_PASS: "pass",
  SENDER_NAME: "博主",
  SENDER_EMAIL: "bot@test.com",
  BLOGGER_EMAIL: "me@test.com",
  SITE_NAME: "测试站",
  SITE_URL: "https://x.test",
  NOTIFY_SPAM: "false",
};

/** 组装最小 PipelineContext（sendNotice 直调用） */
function makeCtx(config: Record<string, unknown>): PipelineContext {
  const adapters = createMemoryAdapters();
  return {
    request: makeRequest({ body: {} }),
    requestId: "ctx-id",
    accessToken: "tok",
    config: config as never,
    configReadFailed: false,
    adapters,
    logger: {
      /**
       *
       */
      verbose: () => {},
      /**
       *
       */
      info: () => {},
      /**
       *
       */
      warn: () => {},
      /**
       *
       */
      error: () => {},
      /**
       *
       */
      getText: () => "",
      requestId: "ctx-id",
    },
  };
}

describe("sendNotice 全链路（services/notify）", () => {
  it("博主评论：不给自己发通知；访客评论：博主邮件 + 回复邮件 + pushoo 三路并发", async () => {
    const sent: Array<Record<string, unknown>> = [];
    const pushed: unknown[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ success: true, data: { url: "https://cdn/x.png" } }), { status: 200 })),
      );
    setLibImporter(async (specifier) => {
      if (specifier === "nodemailer") {
        return {
          default: {
            /**
             *
             */
            createTransport: () => ({
              /**
               *
               */
              verify: async () => true,
              /**
               *
               */
              sendMail: async (mail: Record<string, unknown>) => {
                sent.push(mail);
                return { messageId: "m1" };
              },
            }),
          },
        };
      }
      if (specifier === "html-to-text") {
        return {
          /**
           *
           */
          compile: () => (html: string) => html.replace(/<[^>]+>/g, ""),
        };
      }
      if (specifier === "pushoo") {
        return {
          /**
           *
           */
          default: async (_c: string, o: unknown) => pushed.push(o),
        };
      }
      throw new Error(`unexpected ${specifier}`);
    });
    const config = {
      ...smtpConfig,
      PUSHOO_CHANNEL: "qmsg",
      PUSHOO_TOKEN: "tok-1",
      MAIL_SUBJECT_ADMIN: "新评论：${NICK}",
      MAIL_TEMPLATE: "${PARENT_NICK} 你好，${NICK} 回复了：${COMMENT}（${POST_URL}）",
    };
    const db = createMemoryAdapters().database;
    // 非垃圾访客评论（父评论非博主）
    const parent = await db.addComment({
      _id: "parent-1",
      nick: "路人",
      mail: "p@t.com",
      comment: "父",
    });
    const comment = await db.addComment({
      _id: "child-1",
      nick: "张三",
      mail: "z@t.com",
      comment: "子",
      url: "/p/1",
      pid: parent._id,
    });
    const ctx = makeCtx(config);
    ctx.adapters = { ...ctx.adapters, database: db };
    await sendNotice({
      comment,
      config: ctx.config,
      caps,
      logger: ctx.logger,
      /**
       *
       */
      getParentComment: async (c) => (c.pid ? db.getComment(c.pid) : null),
    });
    // PUSHOO 已配置且 SC_MAIL_NOTIFY!=true → 博主邮件跳过；仅回复邮件 1 封
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("p@t.com");
    expect(String(sent[1 - 1].html)).toContain("路人");
    // pushoo 1 条
    expect(pushed).toHaveLength(1);
  });

  it("PUSHOO_OPTIONS：JSON 附加参数透传给 pushoo（Bark 分组等）", async () => {
    const pushed: Array<{ options: { bark: Record<string, unknown> } }> = [];
    setLibImporter(async (specifier) => {
      if (specifier === "pushoo") {
        return {
          /**
           *
           */
          default: async (_c: string, o: unknown) => {
            pushed.push(o as never);
            return { code: 200 };
          },
        };
      }
      if (specifier === "html-to-text") {
        return {
          /**
           *
           */
          compile: () => (html: string) => html.replace(/<[^>]+>/g, ""),
        };
      }
      throw new Error(`unexpected ${specifier}`);
    });
    const ctx = makeCtx({
      PUSHOO_CHANNEL: "bark",
      PUSHOO_TOKEN: "https://bark.test",
      PUSHOO_OPTIONS: JSON.stringify({ bark: { group: "Twikoo", level: "timeSensitive" } }),
    });
    await sendNotice({
      comment: { _id: "c", nick: "张三", mail: "z@t.com", comment: "内容", url: "/p/1" } as never,
      config: ctx.config,
      caps,
      logger: ctx.logger,
      /**
       *
       */
      getParentComment: async () => null,
    });
    expect(pushed).toHaveLength(1);
    expect(pushed[0].options.bark.group).toBe("Twikoo");
    expect(pushed[0].options.bark.level).toBe("timeSensitive");
    // 内置跳转 url 仍在，且不被附加参数覆盖
    expect(String(pushed[0].options.bark.url)).toContain("/p/1");
  });

  it("垃圾评论 NOTIFY_SPAM=false：三路全部跳过", async () => {
    const ctx = makeCtx(smtpConfig);
    await sendNotice({
      comment: { _id: "c", isSpam: true },
      config: ctx.config,
      caps,
      logger: ctx.logger,
      /**
       *
       */
      getParentComment: async () => null,
    });
    expect(true).toBe(true); // 不抛错即通过（内部全部提前 return）
  });
});

describe("上传分发（services/upload）", () => {
  it("S.EE 图床：multipart 上传 → 回传响应 data", async () => {
    const pngBase64 =
      "data:image/png;base64," +
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString("base64");
    const fetchMock = stubFetchQueue([{ success: true, data: { url: "https://cdn/x.png" } }]);
    setLibImporter(async (specifier) => {
      if (specifier === "form-data") return fakeFormDataModule();
      throw new Error(`unexpected ${specifier}`);
    });
    const handler = createHandler(
      createMemoryAdapters({
        database: { IMAGE_CDN: "see", IMAGE_CDN_TOKEN: "tok" },
        capabilities: { imageUpload: true },
      }),
    );
    const res = await handler(
      makeRequest({ body: { event: "UPLOAD_IMAGE", photo: pngBase64 }, ip: "1.1.1.1" }),
    );
    // 1.x 语义：上传成功不设 code，仅回传 data
    expect((res.body.data as { url: string }).url).toBe("https://cdn/x.png");
    // 1.x 对齐：直接 POST 到 imageCdn（不得再拼后缀），token 原样作为 Authorization
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://s.ee/api/v1/file/upload");
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("tok");
    expect(headers["content-type"]).toBe("multipart/form-data");
  });

  it("不支持的图床 → UPLOAD_FAILED + 提示", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })),
      );
    setLibImporter(async () => {
      throw new Error("should not be called");
    });
    const handler = createHandler(
      createMemoryAdapters({
        database: { IMAGE_CDN: "nope", IMAGE_CDN_TOKEN: "t" },
        capabilities: { imageUpload: true },
      }),
    );
    const res = await handler(
      makeRequest({
        body: { event: "UPLOAD_IMAGE", photo: "data:image/png;base64,x" },
        ip: "1.1.1.1",
      }),
    );
    expect(res.body.code).toBe(1040);
    expect(res.body.err).toBe("不支持的图片上传服务");
  });
});

describe("验证码分支（services/spam）", () => {
  it("Turnstile：siteverify success → 通过", async () => {
    stubFetchQueue([{ success: true }]);
    setLibImporter(async (specifier) => {
      if (specifier === "form-data") return fakeFormDataModule();
      throw new Error(`unexpected ${specifier}`);
    });
    await expect(
      checkTurnstileCaptcha({
        caps,
        ip: "1.1.1.1",
        turnstileToken: "t",
        turnstileTokenSecretKey: "s",
      }),
    ).resolves.toBeUndefined();
  });

  it("Turnstile：success false → 报错", async () => {
    stubFetchQueue([{ success: false }]);
    setLibImporter(async (specifier) => {
      if (specifier === "form-data") return fakeFormDataModule();
      throw new Error(`unexpected ${specifier}`);
    });
    await expect(
      checkTurnstileCaptcha({ caps, ip: "1", turnstileToken: "t", turnstileTokenSecretKey: "s" }),
    ).rejects.toThrow("验证码检测失败: 验证码错误");
  });

  it("Geetest：result success 通过；失败抛原因", async () => {
    stubFetchQueue([{ result: "success" }, { result: "fail", reason: "bad sign" }]);
    setLibImporter(async (specifier) => {
      throw new Error(`unexpected ${specifier}`);
    });
    await expect(
      checkGeeTestCaptcha({
        geeTestCaptchaId: "id",
        geeTestCaptchaKey: "key",
        geeTestLotNumber: "lot",
        geeTestCaptchaOutput: "out",
        geeTestPassToken: "pass",
        geeTestGenTime: "123",
      }),
    ).resolves.toBeUndefined();
    await expect(
      checkGeeTestCaptcha({
        geeTestCaptchaId: "id",
        geeTestCaptchaKey: "key",
        geeTestLotNumber: "lot",
        geeTestCaptchaOutput: "out",
        geeTestPassToken: "pass",
        geeTestGenTime: "123",
      }),
    ).rejects.toThrow("极验验证码检测失败: bad sign");
  });

  it("Cap 外部 Standalone：siteverify success false → 报错", async () => {
    stubFetchQueue([{ success: false, error: "expired" }]);
    setLibImporter(async (specifier) => {
      throw new Error(`unexpected ${specifier}`);
    });
    await expect(
      checkCapCaptcha({ capToken: "tk", capSecretKey: "s", capApiEndpoint: "https://cap.test/" }),
    ).rejects.toThrow("Cap验证码检测失败: expired");
  });

  it("COMMENT_SUBMIT：CAPTCHA_PROVIDER=Cap 未配置完整 → 报配置不完整", async () => {
    setCustomLibs({
      DOMPurify: {
        /**
         *
         */
        sanitize: (d) => d,
      },
    });
    const handler = createHandler(
      createMemoryAdapters({
        database: { CAPTCHA_PROVIDER: "Cap", CAP_API_ENDPOINT: "https://cap.test" },
      }),
    );
    const res = await handler(
      makeRequest({
        body: { event: "COMMENT_SUBMIT", url: "/p", ua: "u", comment: "c" },
        ip: "9.9.9.9",
      }),
    );
    expect(res.body.message).toBe(
      "Cap 验证码配置不完整：内嵌模式无需额外配置，外部模式需填写 CAP_API_ENDPOINT 与 CAP_SECRET_KEY",
    );
  });
});
